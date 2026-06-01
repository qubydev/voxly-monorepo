module.exports = {
    MAX_PARALLEL_THREADS: 4,
    CHUNK_CHAR_LIMIT: 2000,
    QUEUE_NAME: 'tts-queue',
    DEFAULT_VOICE: 'aria',
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN
};