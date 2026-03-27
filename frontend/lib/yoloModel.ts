import * as tf from "@tensorflow/tfjs";
import { DetectedObject } from "@/types/detection";

let model: tf.GraphModel | null = null;

const LABELS = [
  "bed",
  "sofa",
  "chair",
  "table",
  "lamp",
  "laptop",
  "wardrobe",
  "window",
  "door",
  "potted plant",
  "photo frame",
  "mirror",
];

export async function loadModel() {
  if (!model) {
    await tf.ready();
    model = await tf.loadGraphModel("/model/model.json");
  }
  return model;
}

export async function detectObjects(
  video: HTMLVideoElement,
): Promise<DetectedObject[]> {
  if (!model) return [];

  // 1. Pre-process
  const img = tf.browser
    .fromPixels(video)
    .resizeBilinear([640, 640])
    .div(255.0)
    .expandDims(0);

  // 2. Run Inference
  const output = model.predict(img) as tf.Tensor;

  // 3. Post-process
  // We use transpose and squeeze to get [8400, 16]
  const res = output.transpose([0, 2, 1]).squeeze();

  const boxes = res.slice([0, 0], [-1, 4]);
  const scores = res.slice([0, 4], [-1, 12]).max(1);
  const classes = res.slice([0, 4], [-1, 12]).argMax(1);

  // 4. NMS (Asynchronous - Won't block UI)
  const indicesTensor = await tf.image.nonMaxSuppressionAsync(
    boxes as tf.Tensor2D,
    scores as tf.Tensor1D,
    20,
    0.5,
    0.35,
  );

  // 5. Download data to CPU
  const [indices, bData, sData, cData] = await Promise.all([
    indicesTensor.array(),
    boxes.array(),
    scores.array(),
    classes.array(),
  ]);

  // 6. CLEAN UP MEMORY (Very important without tf.tidy)
  tf.dispose([img, output, res, boxes, scores, classes, indicesTensor]);

  // 7. Format results
  const widthRatio = video.videoWidth / 640;
  const heightRatio = video.videoHeight / 640;

  return (indices as number[]).map((idx) => {
    const [xCenter, yCenter, width, height] = (bData as number[][])[idx];
    return {
      id: `det-${Date.now()}-${idx}`,
      class: LABELS[(cData as number[])[idx]],
      score: (sData as number[])[idx],
      bbox: {
        x: (xCenter - width / 2) * widthRatio,
        y: (yCenter - height / 2) * heightRatio,
        width: width * widthRatio,
        height: height * heightRatio,
      },
    };
  });
}
