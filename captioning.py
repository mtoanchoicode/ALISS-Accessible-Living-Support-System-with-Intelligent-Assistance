import cv2
import numpy as np
import torch
from ultralytics import YOLO
import time
from collections import deque
import requests
from PIL import Image
import io
import base64
from sentence_transformers import SentenceTransformer
from transformers import CLIPSegProcessor, CLIPSegForImageSegmentation, AutoModelForCausalLM, AutoTokenizer
import torchvision.models as models
import torchvision.transforms as transforms
import threading
import threading
from dotenv import load_dotenv
import os

load_dotenv()  # Loads .env file

api_key = os.getenv("OPENAI_API_KEY")
import warnings
warnings.filterwarnings('ignore')

class WorldScribeCaptioning:
    def __init__(self, openai_api_key=None):
        """
        Initialize WorldScribe Captioning Pipeline
        """
        print("Initializing WorldScribe Captioning Pipeline...")
        
        # API Key for GPT-4V
        self.openai_api_key = openai_api_key
        
        # Initialize YOLO World for object detection
        print("Loading YOLO World model...")
        self.yolo = YOLO('yolov8n.pt')  # Using YOLOv8 nano as base
        
        # Initialize VGG16 for feature extraction (FC2 layer)
        print("Loading VGG16 model for feature extraction...")
        self.vgg16 = models.vgg16(pretrained=True)
        # Remove the final classification layer to get FC2 features
        self.vgg16.classifier = torch.nn.Sequential(*list(self.vgg16.classifier.children())[:-1])
        self.vgg16.eval()
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.vgg16.to(self.device)
        
        # VGG16 preprocessing
        self.vgg_transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        
        # Initialize Moondream for spatial descriptions
        print("Loading Moondream model...")
        try:
            model_id = "vikhyatk/moondream2"
            revision = "2024-08-26"
            self.moondream_model = AutoModelForCausalLM.from_pretrained(
                model_id, 
                trust_remote_code=True,
                revision=revision
            )
            self.moondream_tokenizer = AutoTokenizer.from_pretrained(model_id, revision=revision)
            self.moondream_model.to(self.device)
            self.moondream_model.eval()
            print("Moondream loaded successfully!")
        except Exception as e:
            print(f"Warning: Could not load Moondream: {e}")
            self.moondream_model = None
        
        # Initialize sentence similarity model for prioritization
        print("Loading sentence similarity model...")
        self.similarity_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Initialize CLIPSeg for semantic segmentation (prioritization)
        print("Loading CLIPSeg model...")
        self.clipseg_processor = CLIPSegProcessor.from_pretrained("CIDAS/clipseg-rd64-refined")
        self.clipseg_model = CLIPSegForImageSegmentation.from_pretrained("CIDAS/clipseg-rd64-refined")

        self.clipseg_model.to(self.device)
        self.clipseg_model.eval()
        
        # Load depth estimation model (simplified - using MiDaS instead of Depth Anything)
        print("Loading depth estimation model...")
        try:
            self.depth_model = torch.hub.load("intel-isl/MiDaS", "MiDaS_small")
            self.depth_model.to(self.device)
            self.depth_model.eval()
            
            midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms")
            self.depth_transform = midas_transforms.small_transform
            print("Depth model loaded successfully!")
        except Exception as e:
            print(f"Warning: Could not load depth model: {e}")
            self.depth_model = None
        
        # Keyframe extraction parameters
        self.n = 5  # consecutive frames threshold
        self.k = 3  # interest indication threshold
        self.thresh_sim = 0.6  # similarity threshold
        self.orientation_threshold = 30  # degrees
        
        # State tracking
        self.prev_keyframe = None
        self.prev_keyframe_rgb = None
        self.prev_orientation = None
        self.frame_buffer = deque(maxlen=self.n)
        self.object_composition_buffer = deque(maxlen=self.n)
        self.consecutive_keyframes = 0
        self.last_keyframe_time = 0
        
        # Description buffer
        self.description_buffer = []
        self.current_descriptions = []
        self.last_spoken_description = ""
        
        # Display buffer for live descriptions
        self.display_descriptions = []
        self.display_lock = threading.Lock()
        
        # User intent (can be modified)
        self.user_intent = "Describe the environment with focus on objects and their spatial relationships"
        
        print("Initialization complete!\n")
    
    def extract_features_vgg16(self, frame):
        """
        Extract VGG16 FC2 layer features for frame similarity
        This is the proper implementation as mentioned in the paper
        """
        # Convert BGR to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(frame_rgb)
        
        # Apply VGG16 preprocessing
        input_tensor = self.vgg_transform(pil_image).unsqueeze(0).to(self.device)
        
        # Extract FC2 features
        with torch.no_grad():
            features = self.vgg16(input_tensor)
        
        # Return as numpy array
        return features.cpu().numpy().flatten()
    
    def compute_cosine_similarity(self, feat1, feat2):
        """Compute cosine similarity between two feature vectors"""
        return np.dot(feat1, feat2) / (np.linalg.norm(feat1) * np.linalg.norm(feat2) + 1e-8)
    
    def estimate_depth(self, frame):
        """
        Generate depth map using MiDaS
        Returns depth map where higher values = closer to camera
        """
        if self.depth_model is None:
            return None
        
        # Convert BGR to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Prepare input
        input_batch = self.depth_transform(frame_rgb).to(self.device)
        
        # Predict depth
        with torch.no_grad():
            prediction = self.depth_model(input_batch)
            prediction = torch.nn.functional.interpolate(
                prediction.unsqueeze(1),
                size=frame.shape[:2],
                mode="bicubic",
                align_corners=False,
            ).squeeze()
        
        depth_map = prediction.cpu().numpy()
        
        # Normalize and invert (higher value = closer)
        depth_map = depth_map.max() - depth_map
        depth_map = (depth_map - depth_map.min()) / (depth_map.max() - depth_map.min() + 1e-8)
        
        return depth_map
    
    def detect_objects_yolo(self, frame):
        """
        YOLO World object detection - generates word-level labels
        Returns object composition as list of (class_name, confidence, bbox)
        """
        results = self.yolo(frame, verbose=False)
        
        objects = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                class_id = int(box.cls[0])
                class_name = self.yolo.names[class_id]
                confidence = float(box.conf[0])
                bbox = box.xyxy[0].cpu().numpy()  # x1, y1, x2, y2
                
                if confidence > 0.5:  # confidence threshold
                    objects.append((class_name, confidence, bbox))
        
        return objects
    
    def get_object_composition_key(self, objects):
        """
        Convert object list to a hashable key for comparison
        """
        if not objects:
            return None
        # Sort by class name for consistent comparison
        sorted_objects = sorted([obj[0] for obj in objects])
        return tuple(sorted_objects)
    
    def is_keyframe(self, frame, objects, frame_idx):
        """
        Keyframe Extraction Layer - determine if current frame is a keyframe
        Based on: object composition consistency and visual similarity
        """
        composition_key = self.get_object_composition_key(objects)
        self.object_composition_buffer.append(composition_key)
        self.frame_buffer.append(frame)
        
        # Need at least n frames to make decision
        if len(self.object_composition_buffer) < self.n:
            return False, "normal"
        
        # Check if object composition is consistent across n frames
        compositions = list(self.object_composition_buffer)
        
        # Case 1: Consistent non-empty composition
        if all(comp == compositions[0] and comp is not None for comp in compositions):
            self.consecutive_keyframes += 1
            # Check if user is interested (k consecutive keyframes)
            if self.consecutive_keyframes >= self.k:
                return True, "verbose"  # User interested, request detailed description
            return True, "normal"
        
        # Case 2: All empty compositions (no objects detected)
        if all(comp is None for comp in compositions):
            # Check visual similarity with previous keyframe
            if self.prev_keyframe is not None:
                current_features = self.extract_features_vgg16(frame)
                prev_features = self.extract_features_vgg16(self.prev_keyframe)
                cos_sim = self.compute_cosine_similarity(current_features, prev_features)
                
                if cos_sim < self.thresh_sim:
                    self.consecutive_keyframes = 0
                    return True, "normal"
            else:
                return True, "normal"
        
        # Case 3: Inconsistent compositions (camera drifting/moving objects)
        if len(set(compositions)) == len(compositions) and all(comp is not None for comp in compositions):
            # Check every 2k frame
            if frame_idx % (2 * self.k) == 0:
                self.consecutive_keyframes = 0
                return True, "concise"  # Concise for fast-changing scenes
        
        self.consecutive_keyframes = 0
        return False, "normal"
    
    def generate_yolo_description(self, objects):
        """
        Generate short phrase description from YOLO detections
        Real-time overview (~0.1s)
        """
        if not objects:
            return "No specific objects detected"
        
        # Get unique object classes with counts
        object_counts = {}
        for obj in objects:
            class_name = obj[0]
            object_counts[class_name] = object_counts.get(class_name, 0) + 1
        
        # Create description
        descriptions = []
        for obj_name, count in object_counts.items():
            if count == 1:
                descriptions.append(f"a {obj_name}")
            else:
                descriptions.append(f"{count} {obj_name}s")
        
        if len(descriptions) == 1:
            return descriptions[0].capitalize()
        elif len(descriptions) <= 3:
            return ", ".join(descriptions).capitalize()
        else:
            return (", ".join(descriptions[:3]) + ", and more").capitalize()
    
    def generate_moondream_description(self, frame, objects):
        """
        Generate spatial relationship description using Moondream
        Returns description with objects and spatial relationships (~3s)
        """
        if self.moondream_model is None:
            # Fallback if Moondream is not available
            if not objects:
                return "The scene appears to be empty or unclear"
            
            unique_objects = list(set([obj[0] for obj in objects]))
            if len(unique_objects) == 1:
                return f"There is a {unique_objects[0]} in the scene"
            elif len(unique_objects) == 2:
                return f"The scene contains a {unique_objects[0]} and a {unique_objects[1]}"
            else:
                return f"The scene shows {', '.join(unique_objects[:3])} and other objects"
        
        try:
            # Convert frame to PIL Image
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(frame_rgb)
            
            # Encode image
            enc_image = self.moondream_model.encode_image(pil_image)
            
            # Generate description focusing on spatial relationships
            prompt = "Describe the objects in this image and their spatial relationships in one sentence."
            
            description = self.moondream_model.answer_question(
                enc_image, 
                prompt, 
                self.moondream_tokenizer
            )
            
            return description
            
        except Exception as e:
            print(f"Moondream error: {e}")
            return "Error generating spatial description"
    
    def generate_gpt4v_description(self, frame, detail_level, objects):
        """
        Generate detailed description using GPT-4V
        Detail levels: "verbose", "normal", "concise"
        Returns list of individual sentences for prioritization
        """
        if not self.openai_api_key:
            return [f"GPT-4V description unavailable (API key not configured) - detected: {', '.join([obj[0] for obj in objects[:5]])}"]
        
        # Convert frame to base64
        _, buffer = cv2.imencode('.jpg', frame)
        image_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Set length constraints based on detail level
        length_constraints = {
            "verbose": "over 15 words, providing rich details about colors, textures, shapes, and spatial relationships",
            "normal": "at least 10 words with moderate detail",
            "concise": "less than 5 words, being brief"
        }
        
        # Build prompt
        visual_attributes = "color, texture, shape, and spatial relationships"
        detected_objects = ", ".join([obj[0] for obj in objects[:5]]) if objects else "various objects"
        
        prompt = f"""You are a helpful visual describer for people who are blind or have low vision. 
You will not mention this is an image; just describe it, and don't mention camera blur or motion.
The scene contains: {detected_objects}.
Please ensure you provide adjectives about {visual_attributes} to enrich the descriptions.
You should describe each object with ONLY ONE sentence at maximum.
Don't use 'it' to refer to an object. Use the object name instead.
Most importantly, each sentence should be {length_constraints[detail_level]}.
Provide each object description as a separate sentence."""
        
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.openai_api_key}"
            }
            
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_base64}"
                                }
                            }
                        ]
                    }
                ],
                "max_tokens": 300
            }
            
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                full_description = result['choices'][0]['message']['content']
                
                # Split into individual sentences for prioritization
                sentences = [s.strip() + '.' for s in full_description.split('.') if s.strip()]
                return sentences
            else:
                return [f"GPT-4V Error: Status {response.status_code}"]
                
        except Exception as e:
            return [f"GPT-4V Error: {str(e)}"]
    
    def extract_subject_with_clipseg(self, frame, description):
        """
        Use CLIPSeg to locate the subject in the description within the frame
        Returns the segmentation mask
        """
        try:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(frame_rgb)
            
            # Extract subject from description (simplified - take first few words)
            subject = " ".join(description.split()[:5])
            
            # Process with CLIPSeg
            inputs = self.clipseg_processor(
                text=[subject], 
                images=[pil_image], 
                padding=True, 
                return_tensors="pt"
            )
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            with torch.no_grad():
                outputs = self.clipseg_model(**inputs)
            
            # Get segmentation mask
            preds = outputs.logits
            mask = torch.sigmoid(preds[0]).cpu().numpy()
            
            # Resize to original frame size
            mask = cv2.resize(mask, (frame.shape[1], frame.shape[0]))
            
            return mask
            
        except Exception as e:
            print(f"CLIPSeg error: {e}")
            return None
    
    def compute_depth_score(self, frame, description, depth_map):
        """
        Compute average depth score for a description's subject
        Higher score = closer to user
        """
        if depth_map is None:
            return 0.0
        
        # Extract subject area using CLIPSeg
        mask = self.extract_subject_with_clipseg(frame, description)
        
        if mask is None:
            return 0.0
        
        # Apply threshold to mask
        binary_mask = (mask > 0.5).astype(np.uint8)
        
        # Compute average depth in masked area
        if binary_mask.sum() > 0:
            depth_score = (depth_map * binary_mask).sum() / binary_mask.sum()
        else:
            depth_score = 0.0
        
        return depth_score
    
    def prioritize_descriptions(self, descriptions, frame, depth_map):
        """
        Description Prioritization Layer
        Sort descriptions by:
        1. Semantic relevance to user intent (threshold-based)
        2. Proximity to user (depth-based)
        
        As described in Section 4.6.1 of the paper
        """
        if not descriptions:
            return []
        
        # Compute similarity scores with user intent
        intent_embedding = self.similarity_model.encode(self.user_intent)
        
        scored_descriptions = []
        for desc in descriptions:
            desc_embedding = self.similarity_model.encode(desc)
            similarity = np.dot(intent_embedding, desc_embedding) / (
                np.linalg.norm(intent_embedding) * np.linalg.norm(desc_embedding) + 1e-8
            )
            
            # Compute depth score
            depth_score = self.compute_depth_score(frame, desc, depth_map)
            
            scored_descriptions.append({
                'description': desc,
                'similarity': similarity,
                'depth': depth_score
            })
        
        # Define threshold for high relevance
        threshold = 0.3  # Can be adjusted
        
        # Separate into high relevance and low relevance sets
        high_relevance = [d for d in scored_descriptions if d['similarity'] >= threshold]
        low_relevance = [d for d in scored_descriptions if d['similarity'] < threshold]
        
        # Sort high relevance by similarity (descending)
        high_relevance.sort(key=lambda x: x['similarity'], reverse=True)
        
        # Sort low relevance by depth (descending - closer first)
        low_relevance.sort(key=lambda x: x['depth'], reverse=True)
        
        # Concatenate: high relevance first, then low relevance sorted by proximity
        prioritized = high_relevance + low_relevance
        
        return [item['description'] for item in prioritized]
    
    def should_present_description(self, description, frame):
        """
        Check if description should be presented based on context
        Section 4.6.2: Selecting up-to-date description
        """
        # Skip if similar to last spoken description
        if self.last_spoken_description:
            desc_embedding = self.similarity_model.encode(description)
            last_embedding = self.similarity_model.encode(self.last_spoken_description)
            similarity = np.dot(desc_embedding, last_embedding) / (
                np.linalg.norm(desc_embedding) * np.linalg.norm(last_embedding) + 1e-8
            )
            
            if similarity > 0.85:  # Very similar to last description
                return False
        
        return True
    
    def process_frame(self, frame, frame_idx):
        """
        Main processing pipeline for each frame
        """
        start_time = time.time()
        
        # Step 1: YOLO World object detection (real-time ~0.1s)
        yolo_start = time.time()
        objects = self.detect_objects_yolo(frame)
        yolo_time = time.time() - yolo_start
        
        yolo_desc = self.generate_yolo_description(objects)
        
        # Step 2: Check if this is a keyframe
        is_key, detail_level = self.is_keyframe(frame, objects, frame_idx)
        
        if is_key:
            print(f"\n{'='*70}")
            print(f"KEYFRAME DETECTED (Frame {frame_idx}) - Detail Level: {detail_level.upper()}")
            print(f"{'='*70}")
            
            # Add YOLO description immediately
            with self.display_lock:
                self.display_descriptions.append({
                    'type': 'YOLO',
                    'text': yolo_desc,
                    'time': yolo_time
                })
            print(f"\n[YOLO - {yolo_time:.2f}s] {yolo_desc}")
            
            # Step 3: Generate Moondream description (spatial relationships ~3s)
            moondream_start = time.time()
            moondream_desc = self.generate_moondream_description(frame, objects)
            moondream_time = time.time() - moondream_start
            
            with self.display_lock:
                self.display_descriptions.append({
                    'type': 'Moondream',
                    'text': moondream_desc,
                    'time': moondream_time
                })
            print(f"[Moondream - {moondream_time:.2f}s] {moondream_desc}")
            
            # Step 4: Generate depth map for prioritization
            depth_start = time.time()
            depth_map = self.estimate_depth(frame)
            depth_time = time.time() - depth_start
            print(f"[Depth Estimation - {depth_time:.2f}s] Complete")
            
            # Step 5: GPT-4V detailed description (~9s)
            gpt4v_start = time.time()
            print(f"[GPT-4V] Generating {detail_level} descriptions...")
            gpt4v_sentences = self.generate_gpt4v_description(frame, detail_level, objects)
            gpt4v_time = time.time() - gpt4v_start
            
            # Step 6: Prioritize GPT-4V descriptions
            prioritize_start = time.time()
            prioritized_sentences = self.prioritize_descriptions(gpt4v_sentences, frame, depth_map)
            prioritize_time = time.time() - prioritize_start
            
            print(f"\n[GPT-4V - {gpt4v_time:.2f}s] Generated {len(gpt4v_sentences)} descriptions")
            print(f"[Prioritization - {prioritize_time:.2f}s] Sorted by relevance and proximity")
            print("\nPrioritized Descriptions:")
            
            for idx, desc in enumerate(prioritized_sentences, 1):
                if self.should_present_description(desc, frame):
                    with self.display_lock:
                        self.display_descriptions.append({
                            'type': f'GPT-4V-{idx}',
                            'text': desc,
                            'time': gpt4v_time
                        })
                    print(f"  {idx}. {desc}")
                    self.last_spoken_description = desc
                    break  # ✅ Only take the first valid description
            
            # Store in buffer
            self.description_buffer.append({
                'frame_idx': frame_idx,
                'yolo': yolo_desc,
                'moondream': moondream_desc,
                'gpt4v': prioritized_sentences,
                'detail_level': detail_level,
                'timestamp': time.time()
            })
            
            # Update state
            self.prev_keyframe = frame.copy()
            self.prev_keyframe_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            self.last_keyframe_time = time.time()
            
            total_time = time.time() - start_time
            print(f"\nTotal Processing Time: {total_time:.2f}s")
            print(f"{'='*70}\n")
            
            return True, {
                'yolo': yolo_desc,
                'moondream': moondream_desc,
                'gpt4v': prioritized_sentences
            }
        
        return False, None
    
    def draw_descriptions_on_frame(self, frame):
        display_frame = frame.copy()
        h, w = display_frame.shape[:2]
        
        # Create a semi-transparent overlay panel on the right side
        panel_width = 400
        overlay = display_frame.copy()
        cv2.rectangle(overlay, (w - panel_width, 0), (w, h), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.7, display_frame, 0.3, 0, display_frame)
        
        with self.display_lock:
            # Show last 5 descriptions
            y_offset = 40
            line_height = 25
            padding = 10
            
            for i, desc_info in enumerate(self.display_descriptions[-5:]):
                desc_type = desc_info['type']
                desc_text = desc_info['text']
                desc_time = desc_info['time']
                
                # Color coding with better visibility
                if 'YOLO' in desc_type:
                    color = (100, 255, 100)  # Bright green
                    type_color = (0, 200, 0)
                elif 'Moondream' in desc_type:
                    color = (100, 200, 255)  # Light blue
                    type_color = (0, 150, 255)
                else:
                    color = (150, 150, 255)  # Light purple for GPT-4V
                    type_color = (100, 100, 255)
                
                # Draw type label with background
                type_label = f"[{desc_type}]"
                (tw, th), _ = cv2.getTextSize(type_label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                cv2.rectangle(display_frame, 
                            (w - panel_width + padding, y_offset - th - 5),
                            (w - panel_width + padding + tw + 10, y_offset + 5),
                            type_color, -1)
                cv2.putText(display_frame, type_label, 
                        (w - panel_width + padding + 5, y_offset),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
                
                y_offset += th + 15
                
                # Word wrap the description text
                max_chars_per_line = 45
                words = desc_text.split()
                lines = []
                current_line = ""
                
                for word in words:
                    test_line = current_line + " " + word if current_line else word
                    if len(test_line) <= max_chars_per_line:
                        current_line = test_line
                    else:
                        if current_line:
                            lines.append(current_line)
                        current_line = word
                
                if current_line:
                    lines.append(current_line)
                
                # Limit to 3 lines max
                lines = lines[:3]
                if len(desc_text) > max_chars_per_line * 3:
                    lines[-1] = lines[-1][:max_chars_per_line-3] + "..."
                
                # Draw each line
                for line in lines:
                    cv2.putText(display_frame, line,
                            (w - panel_width + padding + 10, y_offset),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1, cv2.LINE_AA)
                    y_offset += line_height
                
                y_offset += 10  # Extra spacing between descriptions
                
                # Stop if we're running out of space
                if y_offset > h - 50:
                    break
        
        return display_frame
    
    def run_camera(self):
        """
        Main loop - open camera and start captioning
        """
        print("\n" + "="*70)
        print("Starting WorldScribe Live Captioning")
        print("="*70)
        print("Press 'q' to quit")
        print("Press 'c' to clear description display")
        print("="*70 + "\n")
        
        cap = cv2.VideoCapture(0)
        
        if not cap.isOpened():
            print("Error: Could not open camera")
            return
        
        # Set camera properties
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        
        frame_idx = 0
        
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    print("Error: Could not read frame")
                    break
                
                # Process frame
                is_keyframe, descriptions = self.process_frame(frame, frame_idx)
                
                # Draw descriptions on frame
                display_frame = self.draw_descriptions_on_frame(frame)
                
                # Add frame info
                info_text = f"Frame: {frame_idx} | Keyframes: {len(self.description_buffer)}"
                cv2.putText(display_frame, info_text, (10, display_frame.shape[0] - 10),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
                
                if is_keyframe:
                    cv2.putText(display_frame, "KEYFRAME!", (display_frame.shape[1] - 150, 30),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2, cv2.LINE_AA)
                
                cv2.imshow('WorldScribe Live Captioning', display_frame)
                
                # Handle keyboard input
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    break
                elif key == ord('c'):
                    with self.display_lock:
                        self.display_descriptions.clear()
                    print("Display cleared")
                
                frame_idx += 1
                
        finally:
            cap.release()
            cv2.destroyAllWindows()
            print("\n\nCamera capture stopped.")
            print(f"Total keyframes detected: {len(self.description_buffer)}")
            
            # Print summary
            if self.description_buffer:
                print("\nSession Summary:")
                for i, desc in enumerate(self.description_buffer[-5:], 1):
                    print(f"\nKeyframe {desc['frame_idx']}:")
                    print(f"  Detail Level: {desc['detail_level']}")
                    print(f"  YOLO: {desc['yolo']}")
                    print(f"  Moondream: {desc['moondream']}")
                    if desc['gpt4v']:
                        print(f"  GPT-4V: {desc['gpt4v'][0]}")


    def run_camera_2(self):
        print("\n" + "="*70)
        print("Starting WorldScribe Live Captioning")
        print("="*70)
        print("Press 'q' to quit")
        print("Press 'c' to clear description display")
        print("="*70 + "\n")
        
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("Error: Could not open camera")
            return

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

        frame_idx = 0
        processing_thread = None

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    print("Error: Could not read frame")
                    break

                # Display current camera feed smoothly
                display_frame = self.draw_descriptions_on_frame(frame)
                info_text = f"Frame: {frame_idx} | Keyframes: {len(self.description_buffer)}"
                cv2.putText(display_frame, info_text, (10, display_frame.shape[0] - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

                cv2.imshow('WorldScribe Live Captioning', display_frame)

                # Only start processing next frame if thread not busy
                if processing_thread is None or not processing_thread.is_alive():
                    processing_thread = threading.Thread(
                        target=self.process_frame, args=(frame.copy(), frame_idx)
                    )
                    processing_thread.daemon = True
                    processing_thread.start()

                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    break
                elif key == ord('c'):
                    with self.display_lock:
                        self.display_descriptions.clear()
                    print("Display cleared")

                frame_idx += 1

        finally:
            cap.release()
            cv2.destroyAllWindows()
            print("\n\nCamera capture stopped.")
            print(f"Total keyframes detected: {len(self.description_buffer)}")


def main():
    print("="*60)
    print("WorldScribe Live Visual Captioning Pipeline")
    
    # Initialize pipeline
    # TODO: Add your OpenAI API key here
    OPENAI_API_KEY = api_key 

    pipeline = WorldScribeCaptioning(openai_api_key=OPENAI_API_KEY)
    
    # Run camera capture and captioning
    pipeline.run_camera_2()


if __name__ == "__main__":
    main()