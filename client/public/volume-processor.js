class VolumeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._threshold = 0.0018;
    this._isSpeaking = false;
  }

  calculateRMS(array) {
    let sumSquares = 0;

    for (let i = 0; i < array.length; i++) {
      sumSquares += array[i] ** 2;
    }

    return Math.sqrt(sumSquares / array.length);
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const data = input[0];

    const average = this.calculateRMS(data);

    const isSpeaking = average > this._threshold;
    if (isSpeaking !== this._isSpeaking) {
      this._isSpeaking = isSpeaking;
      this.port.postMessage({ isSpeaking });
    }

    return true;
  }
}

registerProcessor("volume-processor", VolumeProcessor);
