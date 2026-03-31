/**
 * Edge TTS Native Implementation
 *
 * Uses Python edge-tts package for reliable TTS generation.
 */

import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createLogger } from '@/lib/logger';
import path from 'node:path';
import fs from 'node:fs';

const log = createLogger('EdgeTTS');

export interface EdgeTTSOptions {
  voice?: string;
  volume?: string;
  rate?: string;
  pitch?: string;
}

// Windows Store Python 路径
const PYTHON_PATH =
  process.platform === 'win32'
    ? 'C:\\Users\\suoze\\AppData\\Local\\Microsoft\\WindowsApps\\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\\python.exe'
    : 'python3';

export async function edgeTTS(text: string, options: EdgeTTSOptions = {}): Promise<Buffer> {
  const { voice = 'zh-CN-XiaoxiaoNeural', rate = '+0%' } = options;

  log.info(`Edge TTS: voice=${voice}, rate=${rate}, text length=${text.length}`);

  // 创建临时文件路径
  const tempDir = path.join(process.cwd(), '.temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const outputFile = path.join(tempDir, `edge-tts-${Date.now()}.mp3`);

  // 计算语速百分比
  const ratePercent = rate.startsWith('+') || rate.startsWith('-') ? rate : '+0%';

  return new Promise((resolve, reject) => {
    // 构建参数
    const args = [
      '-m',
      'edge_tts',
      '--voice',
      voice,
      '--rate',
      ratePercent,
      '--text',
      text,
      '--write-media',
      outputFile,
    ];

    log.debug(`Running: ${PYTHON_PATH} ${args.join(' ')}`);

    // 使用 spawn 直接执行 Python
    const pythonProcess = spawn(PYTHON_PATH, args, {
      windowsHide: true,
      shell: false,
    });

    let stderr = '';

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('error', (err) => {
      log.error('Python process error:', err);
      reject(new Error(`Failed to run Python edge-tts: ${err.message}`));
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        log.error(`Python edge-tts exited with code ${code}: ${stderr}`);
        reject(new Error(`Python edge-tts failed with code ${code}: ${stderr.slice(0, 200)}`));
        return;
      }

      // 读取生成的音频文件
      try {
        if (!fs.existsSync(outputFile)) {
          reject(new Error('Audio file was not created'));
          return;
        }

        const audioBuffer = fs.readFileSync(outputFile);

        // 删除临时文件
        fs.unlinkSync(outputFile);

        log.info(`Edge TTS success: ${audioBuffer.length} bytes`);
        resolve(audioBuffer);
      } catch (err) {
        reject(new Error(`Failed to read audio file: ${(err as Error).message}`));
      }
    });
  });
}
