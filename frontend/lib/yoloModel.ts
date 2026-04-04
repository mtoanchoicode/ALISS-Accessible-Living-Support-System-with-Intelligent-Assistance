import * as tf from "@tensorflow/tfjs";
import { DetectedObject } from "@/types/detection";

let model: tf.GraphModel | null = null;

// Custom model labels (12 classes) based on metadata.yaml
const COCO_LABELS = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat", "traffic light",
  "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow",
  "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
  "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard", "surfboard",
  "tennis racket", "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
  "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
  "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse", "remote", "keyboard", "cell phone",
  "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase", "scissors", "teddy bear",
  "hair drier", "toothbrush"
];

export async function loadModel() {
  if (!model) {
    await tf.ready();
    model = await tf.loadGraphModel("/model_v2/model.json");
  }
  return model;
}
export async function detectObjects(
  video: HTMLVideoElement,
): Promise<DetectedObject[]> {
  if (!model) return [];

  // 1. Pre-process and Run Inference wrapped in tf.tidy to avoid GPU leaks
  const [boxes, scores, classes] = tf.tidy(() => {
    const imgTensor = tf.browser
      .fromPixels(video)
      .resizeBilinear([640, 640])
      .div(255.0)
      .expandDims(0);

    const outTensor = model!.predict(imgTensor) as tf.Tensor;
    const resTensor = outTensor.transpose([0, 2, 1]).squeeze(); // [8400, 16]

    const boxesTensor = resTensor.slice([0, 0], [-1, 4]); // [8400, 4]
    const classProbsTensor = resTensor.slice([0, 4], [-1, 12]); // [8400, 12]

    // Convert YOLO [xc, yc, w, h] to TFJS NMS [y1, x1, y2, x2]
    const [xc, yc, w, h] = boxesTensor.split(4, 1);
    const halfW = w.div(2.0);
    const halfH = h.div(2.0);
    const y1 = yc.sub(halfH);
    const x1 = xc.sub(halfW);
    const y2 = yc.add(halfH);
    const x2 = xc.add(halfW);
    const nmsBoxes = tf.concat([y1, x1, y2, x2], 1);

    const scoresTensor = classProbsTensor.max(1); // best score per box
    const classesTensor = classProbsTensor.argMax(1); // best class per box

    return [nmsBoxes, scoresTensor, classesTensor];
  });

  // 4. NMS
  const indicesTensor = await tf.image.nonMaxSuppressionAsync(
    boxes as tf.Tensor2D,
    scores as tf.Tensor1D,
    30,      // Max Output Size
    0.45,    // IOU Threshold
    0.50,    // Score Threshold (lowered slightly for custom fine-tuned model)
  );

  // 5. Move to CPU
  const [indices, bData, sData, cData] = await Promise.all([
    indicesTensor.array(),
    boxes.array(),
    scores.array(),
    classes.array(),
  ]);

  // 6. Clean memory
  tf.dispose([boxes, scores, classes, indicesTensor]);

  // 7. Scale boxes back
  const widthRatio = video.videoWidth / 640;
  const heightRatio = video.videoHeight / 640;

  // 8. Map to DetectedObject array
  return (indices as number[])
    .map((idx) => {
      const classId = (cData as number[])[idx];
      if (classId < 24 || classId > 80) return null;

      const [y1, x1, y2, x2] = (bData as number[][])[idx];
      
      return {
        id: `det-${Date.now()}-${idx}`,
        class: COCO_LABELS[classId],
        score: (sData as number[])[idx],
        bbox: {
          x: x1 * widthRatio,
          y: y1 * heightRatio,
          width: (x2 - x1) * widthRatio,
          height: (y2 - y1) * heightRatio,
        },
      };
    })
    .filter((item): item is DetectedObject => item !== null);
}
