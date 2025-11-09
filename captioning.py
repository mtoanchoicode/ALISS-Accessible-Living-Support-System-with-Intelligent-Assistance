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
from dotenv import load_dotenv
import os
import threading, queue, time

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
            model_id = "vikhyatk/moondream" #moondream2
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
        self.n = 50  # consecutive frames threshold
        self.k = 30  # interest indication threshold
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

        # Price optimize
        self.gpt_cooldown = 30  # seconds, adjust as needed
        self.last_gpt_time = 0
        
        print("Initialization complete!\n")

        self.frame_queue = queue.Queue(maxsize=2)      # keep only the newest
        self.result_ready = threading.Event()
        self.latest_result = None
        self.worker = threading.Thread(target=self._worker_loop, daemon=True)
        self.worker.start()

    # ------------------------------------------------------------------
    # 1. CAPTURE THREAD (runs in run_camera_2)
    # ------------------------------------------------------------------
    def _enqueue_latest(self, frame, idx):
        # drop old frames – only the newest matters
        while self.frame_queue.qsize() > 0:
            try: self.frame_queue.get_nowait()
            except queue.Empty: break
        self.frame_queue.put((frame.copy(), idx))

    # ------------------------------------------------------------------
    # 2. WORKER THREAD (heavy processing)
    # ------------------------------------------------------------------
    def _worker_loop(self):
        while True:
            frame, idx = self.frame_queue.get()   # blocks until a frame arrives
            self.result_ready.clear()
            is_key, result = self.process_frame(frame, idx)   # ← SAME function as before
            if is_key:
                with self.display_lock:
                    self.latest_result = result
                self.result_ready.set()
            self.frame_queue.task_done()
    
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
        Returns: (is_keyframe: bool, detail_level: str)
        """
        composition_key = self.get_object_composition_key(objects)
        self.object_composition_buffer.append(composition_key)
        self.frame_buffer.append(frame)
        
        current_time = time.time()

        # Need at least n frames
        if len(self.object_composition_buffer) < self.n:
            return False, "normal"
        
        compositions = list(self.object_composition_buffer)
        first_comp = compositions[0]

        # === CASE 1: STABLE NON-EMPTY SCENE ===
        if all(comp == first_comp and comp is not None for comp in compositions):
            self.consecutive_keyframes += 1

            # First time we detect user interest (k stable frames)
            if self.consecutive_keyframes == self.k:
                self.last_gpt_time = current_time
                return True, "verbose"  # Trigger full GPT

            # After GPT, enter cooldown (only YOLO + Moondream)
            if (self.consecutive_keyframes > self.k and 
                current_time - self.last_gpt_time < self.gpt_cooldown):
                return True, "normal"  # Keyframe but NO GPT

            # Cooldown expired → allow next GPT
            if current_time - self.last_gpt_time >= self.gpt_cooldown:
                self.last_gpt_time = current_time
                return True, "verbose"

            return True, "normal"  # Stable, but cooldown active

        # === CASE 2: STABLE EMPTY SCENE (no objects) ===
        if all(comp is None for comp in compositions):
            self.consecutive_keyframes += 1

            if self.prev_keyframe is None:
                self.last_gpt_time = current_time
                return True, "normal"

            # Compare visual similarity
            current_features = self.extract_features_vgg16(frame)
            prev_features = self.extract_features_vgg16(self.prev_keyframe)
            cos_sim = self.compute_cosine_similarity(current_features, prev_features)

            if cos_sim > self.thresh_sim:  # Very similar → not a change
                if current_time - self.last_gpt_time < self.gpt_cooldown:
                    return False, "normal"  # SKIP FULL PROCESSING
                else:
                    self.last_gpt_time = current_time
                    return True, "normal"

            # Visual change → treat as new keyframe
            self.last_gpt_time = current_time
            return True, "normal"

        # === CASE 3: INCONSISTENT (moving/changing) ===
        unique_comps = set(c for c in compositions if c is not None)
        if len(unique_comps) > 1:
            # Scene is changing → sample periodically
            if frame_idx % (2 * self.k) == 0:
                self.last_gpt_time = current_time
                return True, "concise"
            return False, "normal"  # Skip non-sampled changing frames

        # Default: not enough data or edge case
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
            print("[Moondream] Starting generation...")
            print(f"Model type: {type(self.moondream_model)}")
            print(f"Tokenizer type: {type(self.moondream_tokenizer)}")

            # Step 1: Convert frame to PIL Image
            print("[Moondream] Converting frame to RGB PIL image...")
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(frame_rgb.astype("uint8"))
            print(f"[Moondream] Image mode: {pil_image.mode}, size: {pil_image.size}")

            # Step 2: Encode image
            if not hasattr(self.moondream_model, "encode_image"):
                print("[Moondream ERROR] encode_image() missing from model!")
            else:
                print("[Moondream] Encoding image...")
            enc_image = self.moondream_model.encode_image(pil_image)
            print("[Moondream] Image encoded successfully.")

            # Step 3: Ask question
            prompt = "Describe the objects in this image and their spatial relationships in one sentence."
            print(f"[Moondream] Asking question: {prompt}")

            if not hasattr(self.moondream_model, "answer_question"):
                print("[Moondream ERROR] answer_question() missing from model!")

            description = self.moondream_model.answer_question(
                enc_image,
                prompt,
                self.moondream_tokenizer
            )

            print("[Moondream] Got description:", description)
            return description

        except Exception as e:
            import traceback
            print("❌ Moondream error:", e)
            traceback.print_exc()  # prints full stack trace for detailed context
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
            Describe all in 1 short sentences only, focusing only the objects closet and their attributes (like focus on the chair, door ignore lighting, etc).
            Make sure the caption is straightforward and easy to understand for someone who cannot see the image such as 'there are red apples on a wooden table'.
            """
        #You should describe each object with ONLY ONE sentence at maximum.
        #    Don't use 'it' to refer to an object. Use the object name instead.
        #    Most importantly, each sentence should be {length_constraints[detail_level]}.
        #    Provide each object description as a separate sentence.
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
        start_time = time.time()
        
        # ALWAYS RUN YOLO
        yolo_start = time.time()
        objects = self.detect_objects_yolo(frame)
        yolo_time = time.time() - yolo_start
        yolo_desc = self.generate_yolo_description(objects)

        # Add YOLO desc immediately
        with self.display_lock:
            self.display_descriptions.append({
                'type': 'YOLO',
                'text': yolo_desc,
                'time': yolo_time
            })
        print(f"[YOLO - {yolo_time:.2f}s] {yolo_desc}")

        # CHECK KEYFRAME
        is_key, detail_level = self.is_keyframe(frame, objects, frame_idx)

        if not is_key:
            # NO KEYFRAME → SKIP MOONDREAM + GPT
            return False, {'yolo': yolo_desc}

        # === KEYFRAME: RUN MOONDREAM ===
        print(f"\n{'='*70}")
        print(f"KEYFRAME (Frame {frame_idx}) - Level: {detail_level.upper()}")
        print(f"{'='*70}")

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

        # === ONLY RUN GPT IF detail_level == 'verbose' or 'concise' ===
        if detail_level in ["verbose", "concise"]:
            depth_start = time.time()
            depth_map = self.estimate_depth(frame)
            depth_time = time.time() - depth_start
            print(f"[Depth - {depth_time:.2f}s] Complete")

            gpt4v_start = time.time()
            print(f"[GPT-4V] Generating {detail_level} description...")
            gpt4v_sentences = self.generate_gpt4v_description(frame, detail_level, objects)
            gpt4v_time = time.time() - gpt4v_start

            prioritize_start = time.time()
            prioritized_sentences = self.prioritize_descriptions(gpt4v_sentences, frame, depth_map)
            prioritize_time = time.time() - prioritize_start

            print(f"[GPT-4V - {gpt4v_time:.2f}s] {len(gpt4v_sentences)} sentences")
            print(f"[Prioritize - {prioritize_time:.2f}s]")

            for idx, desc in enumerate(prioritized_sentences, 1):
                if self.should_present_description(desc, frame):
                    with self.display_lock:
                        self.display_descriptions.append({
                            'type': f'GPT-4V',
                            'text': desc,
                            'time': gpt4v_time
                        })
                    print(f"  {idx}. {desc}")
                    self.last_spoken_description = desc
                    break

            result = {
                'yolo': yolo_desc,
                'moondream': moondream_desc,
                'gpt4v': prioritized_sentences
            }
        else:
            # normal keyframe → NO GPT
            result = {
                'yolo': yolo_desc,
                'moondream': moondream_desc,
                'gpt4v': None
            }

        # Store + update state
        self.description_buffer.append({
            'frame_idx': frame_idx,
            'yolo': yolo_desc,
            'moondream': moondream_desc,
            'gpt4v': result['gpt4v'],
            'detail_level': detail_level,
            'timestamp': time.time()
        })

        self.prev_keyframe = frame.copy()
        self.prev_keyframe_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        self.last_keyframe_time = time.time()

        total_time = time.time() - start_time
        print(f"Total: {total_time:.2f}s\n{'='*70}\n")

        return True, result
    
    def draw_descriptions_on_frame(self, frame):
        display_frame = frame.copy()
        h, w = display_frame.shape[:2]
        
        # Create a semi-transparent right-side panel
        panel_width = 400
        overlay = display_frame.copy()
        cv2.rectangle(overlay, (w - panel_width, 0), (w, h), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.7, display_frame, 0.3, 0, display_frame)

        # Define fixed categories and colors
        fixed_types = ["YOLO", "Moondream", "GPT-4V"]
        colors = {
            "YOLO": ((100, 255, 100), (0, 200, 0)),        # text, label
            "Moondream": ((100, 200, 255), (0, 150, 255)),
            "GPT-4V": ((150, 150, 255), (100, 100, 255)),
        }

        with self.display_lock:
            # Build a dict of latest descriptions from existing list
            latest_by_type = {t: None for t in fixed_types}
            for desc_info in reversed(self.display_descriptions):
                desc_type = desc_info.get("type", "")
                if desc_type in latest_by_type and latest_by_type[desc_type] is None:
                    latest_by_type[desc_type] = desc_info["text"]
                # Stop early if we already have all 3
                if all(latest_by_type.values()):
                    break

            y_offset = 50
            line_height = 25
            padding = 10

            for source in fixed_types:
                text_color, label_color = colors[source]
                label = f"[{source}]"
                desc_text = latest_by_type[source] or "Waiting..."

                # Draw label background
                (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
                cv2.rectangle(
                    display_frame,
                    (w - panel_width + padding, y_offset - th - 5),
                    (w - panel_width + padding + tw + 10, y_offset + 5),
                    label_color, -1
                )
                cv2.putText(
                    display_frame,
                    label,
                    (w - panel_width + padding + 5, y_offset),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA
                )

                y_offset += th + 10

                # Word-wrap text
                max_chars_per_line = 45
                words = desc_text.split()
                lines = []
                current_line = ""

                for word in words:
                    test_line = current_line + " " + word if current_line else word
                    if len(test_line) <= max_chars_per_line:
                        current_line = test_line
                    else:
                        lines.append(current_line)
                        current_line = word
                if current_line:
                    lines.append(current_line)
                lines = lines[:8]
                if len(desc_text) > max_chars_per_line * 8:
                    lines[-1] = lines[-1][:max_chars_per_line-3] + "..."

                for line in lines:
                    cv2.putText(
                        display_frame,
                        line,
                        (w - panel_width + padding + 10, y_offset),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.45,
                        text_color,
                        1,
                        cv2.LINE_AA
                    )
                    y_offset += line_height

                y_offset += 20  # Space between sections

        return display_frame

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

                self._enqueue_latest(frame, frame_idx)

                # 3. If a new description is ready, draw it
                if self.result_ready.is_set():
                    # (optional) flash a tiny “new description” indicator
                    pass

                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'): break
                frame_idx += 1

                # # Only start processing next frame if thread not busy
                # if processing_thread is None or not processing_thread.is_alive():
                #     processing_thread = threading.Thread(
                #         target=self.process_frame, args=(frame.copy(), frame_idx)
                #     )
                #     processing_thread.daemon = True
                #     processing_thread.start()

                # key = cv2.waitKey(1) & 0xFF
                # if key == ord('q'):
                #     break
                # elif key == ord('c'):
                #     with self.display_lock:
                #         self.display_descriptions.clear()
                #     print("Display cleared")

                # frame_idx += 1

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