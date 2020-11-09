// eslint-disable-next-line no-unused-vars
import * as Comlink from "comlink";
import VanillaWorkerMainThread from "@root/mains/vanilla.main";
import unmuteIosAudio from "unmute-ios-audio";
import SharedArrayBufferMainThread from "@root/mains/sab.main";
import AudioWorkletMainThread from "@root/mains/worklet.main";
import ScriptProcessorNodeMainThread from "@root/mains/old-spn.main";
import ScriptProcessorNodeSingleThread from "@root/mains/spn.main";
import wasmDataURI from "@csound/wasm/lib/libcsound.wasm.zlib";
import log, { logSAB, logWorklet, logVAN } from "@root/logger";
import {
  areWorkletsSupported,
  isSabSupported,
  isScriptProcessorNodeSupported,
  WebkitAudioContext,
} from "@root/utils";

/**
 * The default entry for libcsound es7 module
 * @async
 * @return {Promise.<Object>}
 */
export async function Csound({
  audioContext = new (WebkitAudioContext())(),
  useWorker = false,
} = {}) {
  unmuteIosAudio();

  const workletSupport = areWorkletsSupported();
  const spnSupport = isScriptProcessorNodeSupported();

  // SingleThread implementations
  if (!useWorker) {
    const instance = new ScriptProcessorNodeSingleThread({ audioContext });
    return await instance.initialize(wasmDataURI);
  }

  if (workletSupport) {
    logWorklet(`support detected`);
  } else if (spnSupport) {
    logVAN(`support detected`);
  } else {
    log.warning(`No WebAudio Support detected`);
  }

  let audioWorker;
  let csoundWasmApi;

  if (workletSupport) {
    audioWorker = new AudioWorkletMainThread();
  } else if (spnSupport) {
    audioWorker = new ScriptProcessorNodeMainThread();
  }

  if (!audioWorker) {
    log.error("No detectable WebAudioAPI in current environment");
    return undefined;
  }

  const hasSABSupport = isSabSupported();

  if (!hasSABSupport) {
    log.warning(`SharedArrayBuffers not found, falling back to Vanilla concurrency`);
  } else {
    logSAB(`using SharedArrayBuffers`);
  }

  const worker =
    hasSABSupport && workletSupport
      ? new SharedArrayBufferMainThread(audioWorker, wasmDataURI)
      : new VanillaWorkerMainThread(audioWorker, wasmDataURI);

  if (worker) {
    log(`starting Csound thread initialization via WebWorker`);
    await worker.initialize();
    csoundWasmApi = worker.api;
  } else {
    log.error("No detectable WebAssembly support in current environment");
    return undefined;
  }

  return csoundWasmApi;
}

export default Csound;