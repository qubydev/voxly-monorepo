const { EdgeTTS } = require('node-edge-tts');
const { readFile, unlink } = require('fs/promises');
const { join } = require('path');
const { randomBytes } = require('crypto');
const os = require('os');
const pLimit = require('p-limit').default;
const { splitText } = require('./textSplitter');
const { MAX_PARALLEL_THREADS, DEFAULT_VOICE } = require('./config');
const { VOICES } = require('./voices');

const limit = pLimit(MAX_PARALLEL_THREADS);
const VALID_VOICES = new Set(VOICES.map(v => v.id));

async function generateAudioFromProvider(chunk, voice, retries = 3) {
    const selectedVoice = VALID_VOICES.has(voice)
        ? voice
        : DEFAULT_VOICE;

    const tempFile = join(
        os.tmpdir(),
        `tts-chunk-${randomBytes(8).toString('hex')}.mp3`
    );

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const tts = new EdgeTTS({ voice: selectedVoice });
            await tts.ttsPromise(chunk, tempFile);

            const buffer = await readFile(tempFile);
            await unlink(tempFile);

            return buffer;
        } catch (error) {
            try {
                await unlink(tempFile);
            } catch { }

            if (attempt === retries) {
                throw new Error(
                    error?.message ||
                    (typeof error === 'string'
                        ? error
                        : 'Provider disconnected')
                );
            }

            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

async function processTTS(text, voice, onProgress) {
    const chunks = splitText(text);
    const totalChunks = chunks.length;
    let completedChunks = 0;
    let hasFailed = false;
    let failureError = null;

    if (onProgress) {
        await onProgress(completedChunks, totalChunks);
    }

    const tasks = chunks.map(chunk =>
        limit(async () => {
            if (hasFailed) {
                throw failureError || new Error('Job aborted due to previous chunk failure');
            }

            try {
                const buffer = await generateAudioFromProvider(chunk, voice);

                completedChunks++;

                if (onProgress) {
                    await onProgress(completedChunks, totalChunks);
                }

                return buffer;
            } catch (error) {
                hasFailed = true;
                failureError = failureError || error;
                throw error;
            }
        })
    );

    const audioBuffers = await Promise.all(tasks);

    return Buffer.concat(audioBuffers);
}

module.exports = { processTTS };
