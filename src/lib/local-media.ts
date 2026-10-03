import { interpretReceipt } from "@/lib/receipt";

export async function readReceiptOnDevice(file: File, today: string) {
  if (!["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error("Elige una foto JPG, PNG, WebP o HEIC de hasta 10 MB.");
  }
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["spa", "eng"], 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr",
    langPath: "/ocr",
    workerBlobURL: false,
  });
  try {
    const result = await worker.recognize(file);
    return { ...interpretReceipt(result.data.text, today), text: result.data.text };
  } finally {
    await worker.terminate();
  }
}

type Transcription = { text: string } | { text: string }[];
let transcriberPromise: Promise<(input: string, options: { language: string; task: string }) => Promise<Transcription>> | null = null;

async function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const { env, pipeline } = await import("@huggingface/transformers");
      env.allowRemoteModels = false;
      env.localModelPath = "/models/";
      const wasm = env.backends.onnx.wasm;
      if (!wasm) throw new Error("La transcripción local no está disponible en este navegador.");
      wasm.wasmPaths = "/models/runtime/";
      wasm.numThreads = 1;
      const model = await pipeline("automatic-speech-recognition", "whisper-tiny", { device: "wasm", dtype: "q8" });
      return (input: string, options: { language: string; task: string }) => model(input, options) as Promise<Transcription>;
    })().catch((error) => {
      transcriberPromise = null;
      throw error;
    });
  }
  return transcriberPromise;
}

export async function transcribeOnDevice(file: Blob) {
  if (file.size > 8 * 1024 * 1024) throw new Error("El audio es demasiado largo. Prueba con uno de menos de 20 segundos.");
  const url = URL.createObjectURL(file);
  try {
    const transcriber = await getTranscriber();
    const result = await transcriber(url, { language: "spanish", task: "transcribe" });
    return (Array.isArray(result) ? result[0]?.text : result.text)?.trim() ?? "";
  } finally {
    URL.revokeObjectURL(url);
  }
}
