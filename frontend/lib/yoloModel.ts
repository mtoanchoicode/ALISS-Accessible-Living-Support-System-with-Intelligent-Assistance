import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { DetectedObject } from "../types/detection";

// ---------------------------------------------------------------------------
// COCO-SSD labels (80 classes, 0-indexed)
// ---------------------------------------------------------------------------
const COCO_LABELS = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
  "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
  "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
  "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
  "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
  "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
  "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
  "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
  "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator",
  "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush",
];

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const YOLO_INPUT_SIZE = 640;
const NMS_MAX_BOXES = 20;
const NMS_IOU_THRESHOLD = 0.5;
const NMS_SCORE_THRESHOLD = 0.35;

/** Set to `null` to keep all 80 classes, or provide an inclusive [min, max] class-index range. */
const CLASS_FILTER: [number, number] | null = null;

// ---------------------------------------------------------------------------
// Model state — lazy-loaded singletons
// ---------------------------------------------------------------------------
type ModelMode = "yolo" | "coco-ssd";

let yoloModel: tf.GraphModel | null = null;
let cocoModel: cocoSsd.ObjectDetection | null = null;
let activeMode: ModelMode | null = null;

// ---------------------------------------------------------------------------
// Public: loadModel
// ---------------------------------------------------------------------------

/**
 * Loads the YOLO model from `/model/model.json`.
 * Falls back automatically to COCO-SSD (MobileNetV2) if YOLO is unavailable.
 */
export async function loadModel(): Promise<ModelMode> {
  if (activeMode && (yoloModel || cocoModel)) return activeMode;

  await tf.ready();

  try {
    yoloModel = await tf.loadGraphModel("/model/model.json");
    activeMode = "yolo";
    console.info("[detection] YOLO model loaded.");
  } catch (err) {
    console.warn(
      "[detection] YOLO unavailable, falling back to COCO-SSD:",
      err,
    );
    cocoModel = await cocoSsd.load({ base: "lite_mobilenet_v2" });
    activeMode = "coco-ssd";
    console.info("[detection] COCO-SSD fallback loaded.");
  }

  return activeMode;
}

// ---------------------------------------------------------------------------
// Public: detectObjects
// ---------------------------------------------------------------------------

let isReloadingHMR = false;

export async function detectObjects(
  video: HTMLVideoElement,
): Promise<DetectedObject[]> {
  // Check if model memory was cleared by Next.js Fast Refresh
  if (!activeMode || (!yoloModel && !cocoModel)) {
    if (!isReloadingHMR) {
      console.warn("[detection] Model memory lost due to Hot Reload. Reloading automatically in background...");
      isReloadingHMR = true;
      
      loadModel()
        .then(() => { isReloadingHMR = false; })
        .catch(() => { isReloadingHMR = false; });
    }
    return []; // Return empty array to prevent app crash while reloading
  }

  return activeMode === "yolo"
    ? detectWithYolo(video)
    : detectWithCocoSsd(video);
}

// ---------------------------------------------------------------------------
// Public: disposeModels  (call on component unmount to free GPU memory)
// ---------------------------------------------------------------------------

export function disposeModels(): void {
  yoloModel?.dispose();
  yoloModel = null;
  cocoModel = null;
  activeMode = null;
}

// ---------------------------------------------------------------------------
// Internal: YOLO pipeline
// ---------------------------------------------------------------------------

async function detectWithYolo(
  video: HTMLVideoElement,
): Promise<DetectedObject[]> {
  if (!yoloModel) return [];

  const { videoWidth: vw, videoHeight: vh } = video;
  const widthRatio = vw / YOLO_INPUT_SIZE;
  const heightRatio = vh / YOLO_INPUT_SIZE;

  // 1. Pre-process — keep inside tidy() to auto-dispose intermediates
  const img = tf.tidy(() =>
    tf.browser
      .fromPixels(video)
      .resizeBilinear([YOLO_INPUT_SIZE, YOLO_INPUT_SIZE])
      .div(255.0)
      .expandDims(0),
  );

  // 2. Inference
  const rawOutput = yoloModel.predict(img) as tf.Tensor;

  // 3. Reshape: e.g., [1, 16, 8400] → [8400, 16]
  const res = tf.tidy(
    () =>
      (rawOutput as tf.Tensor).transpose([0, 2, 1]).squeeze() as tf.Tensor2D,
  );

  // DYNAMIC FIX: Calculate available classes based on tensor shape
  const numColumns = res.shape[1]; 
  const numClasses = numColumns - 4; 

  // 4. Split boxes [8400, 4] and class probabilities [8400, numClasses]
  const boxes = res.slice([0, 0], [-1, 4]) as tf.Tensor2D;
  const classProbs = res.slice([0, 4], [-1, numClasses]);
  const scores = classProbs.max(1) as tf.Tensor1D;
  const classes = classProbs.argMax(1);

  // 5. NMS
  const indicesTensor = await tf.image.nonMaxSuppressionAsync(
    boxes,
    scores,
    NMS_MAX_BOXES,
    NMS_IOU_THRESHOLD,
    NMS_SCORE_THRESHOLD,
  );

  // 6. Transfer to CPU
  const [indices, bData, sData, cData] = await Promise.all([
    indicesTensor.array() as Promise<number[]>,
    boxes.array() as Promise<number[][]>,
    scores.array() as Promise<number[]>,
    classes.array() as Promise<number[]>,
  ]);

  // 7. Free GPU tensors
  tf.dispose([
    img,
    rawOutput,
    res,
    boxes,
    classProbs,
    scores,
    classes,
    indicesTensor,
  ]);

  // 8. Map → DetectedObject[]
  const results: DetectedObject[] = [];

  for (const idx of indices) {
    const classId = cData[idx];

    if (
      CLASS_FILTER &&
      (classId < CLASS_FILTER[0] || classId > CLASS_FILTER[1])
    ) {
      continue;
    }

    const [xCenter, yCenter, width, height] = bData[idx];

    // Support for custom model classes fallback
    const className = numClasses === 80 
      ? COCO_LABELS[classId] 
      : `Custom Class ${classId}`;

    results.push({
      id: `det-${Date.now()}-${idx}`,
      class: className,
      score: sData[idx],
      bbox: {
        x: (xCenter - width / 2) * widthRatio,
        y: (yCenter - height / 2) * heightRatio,
        width: width * widthRatio,
        height: height * heightRatio,
      },
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Internal: COCO-SSD pipeline (fallback)
// ---------------------------------------------------------------------------

async function detectWithCocoSsd(
  video: HTMLVideoElement,
): Promise<DetectedObject[]> {
  if (!cocoModel) return [];

  const predictions = await cocoModel.detect(video);

  return predictions
    .filter(({ class: cls }) => {
      if (!CLASS_FILTER) return true;
      const classId = COCO_LABELS.indexOf(cls);
      return classId >= CLASS_FILTER[0] && classId <= CLASS_FILTER[1];
    })
    .map((pred, index) => ({
      id: `det-${Date.now()}-${index}`,
      class: pred.class,
      score: pred.score,
      bbox: {
        x: pred.bbox[0],
        y: pred.bbox[1],
        width: pred.bbox[2],
        height: pred.bbox[3],
      },
    }));
}