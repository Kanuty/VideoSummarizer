const youtubedl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');
const cliProgress = require('cli-progress');

const speech = require('@google-cloud/speech');
const ffmpeg = require('fluent-ffmpeg');

const client = new speech.SpeechClient({
    keyFilename: path.join(__dirname, 'text-to-speech-425010-5c7c031c5cb2.json')
});


const extractAudio = (videoPath, audioPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .output(audioPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
};

const transcribeAudio = async (audioPath, languageCode) => {
    const file = fs.readFileSync(audioPath);
    const audioBytes = file.toString('base64');

    const request = {
        audio: {
            content: audioBytes,
        },
        config: {
            encoding: 'LINEAR16',
            sampleRateHertz: 16000,
            languageCode: languageCode,
        },
    };

    const [response] = await client.recognize(request);
    const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join('\n');
    return transcription;
};

const transcribeVideo = async (videoPath, languageCode) => {
    const audioPath = path.join(__dirname, 'temp_audio.wav');

    try {
        // Extract audio from video
        await extractAudio(videoPath, audioPath);
        console.log('Audio extracted successfully');

        // Transcribe audio
        const transcription = await transcribeAudio(audioPath, languageCode);
        console.log('Transcription completed');
        return transcription;
    } catch (error) {
        console.error('Error during transcription:', error);
        throw error;
    } finally {
        // Clean up temporary audio file
        if (fs.existsSync(audioPath)) {
            fs.unlinkSync(audioPath);
        }
    }
};

const downloadVideo = (url, outputDir) => {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(outputDir, '%(title)s.%(ext)s');

        const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        progressBar.start(100, 0);

        const options = {
            output: outputPath,
            format: 'best',
            progress: (progress) => {
                const percent = parseFloat(progress.percent);
                progressBar.update(percent);
            },
        };

        youtubedl(url, options)
            .then((output) => {
                progressBar.update(100);
                progressBar.stop();
                console.log('Download complete:', output);
                resolve(output);
            })
            .catch((error) => {
                progressBar.stop();
                console.error('Download failed:', error);
                reject(error);
            });
    });
};

const downloadMultipleVideos = async (urls, outputDir) => {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    for (const url of urls) {
        try {
            await downloadVideo(url, outputDir);
        } catch (error) {
            console.error('Error downloading video:', error);
        }
    }
};

const getLatestVideos = async (url, outputDir) => {
    const options = {
        dumpSingleJson: true,
        flatPlaylist: true
    };

    try {
        const playlistData = await youtubedl(url, options);
        const videoUrls = playlistData.entries.map(entry => `https://www.youtube.com/watch?v=${entry.id}`);
        await downloadMultipleVideos(videoUrls, outputDir);
    } catch (error) {
        console.error('Failed to get video list:', error);
    }
};

const main = async () => {
    // const outputDir = path.join(__dirname, 'downloads');
    // const channelOrPlaylistUrl = 'https://www.youtube.com/watch?v=UUmn3DNU3_I&list=PLfD2QdAA00HK9iTP1edBxer4YeTWk3OjP&ab_channel=Strategy%26Future';
    
    // Download all videos from the playlist
    // await getLatestVideos(channelOrPlaylistUrl, outputDir);
    const videoPath = path.join(__dirname, 'downloads', 'Wielka Strategia Polski w czasach chaosu ｜ J. Bartosiak, M. Budzisz, M. Stefan, A. Świdziński cz. 4.mp4'); 
    const languageCode = 'pl-PL'; // replace with desired language code

    try {
        const transcript = await transcribeVideo(videoPath, languageCode);
        console.log('Transcript:', transcript);
    } catch (error) {
        console.error('Failed to transcribe video:', error);
    }

};

main();