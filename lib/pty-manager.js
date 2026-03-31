import pty from 'node-pty';
import { RingBuffer } from './ring-buffer.js';

const OUTPUT_BUFFER_SIZE = 100 * 1024; // 100KB per terminal

/**
 * Spawn a PTY process and attach it to a session terminal slot.
 * Returns the terminal entry { pty, outputBuffer } on success,
 * or null if spawn fails (the caller receives an 'exit' message).
 */
export function spawnTerminal({ id, cols, rows, cwd, onData, onExit }) {
  const shell = process.env.SHELL || '/bin/bash';
  let ptyProcess;
  try {
    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: cols || 80,
      rows: rows || 24,
      cwd,
      env: process.env,
    });
  } catch (err) {
    console.error(`Failed to spawn shell "${shell}":`, err.message);
    onExit(id, 1);
    return null;
  }

  const outputBuffer = new RingBuffer(OUTPUT_BUFFER_SIZE);

  ptyProcess.onData((data) => {
    outputBuffer.write(data);
    onData(id, data);
  });

  ptyProcess.onExit(({ exitCode }) => {
    onExit(id, exitCode);
  });

  return { pty: ptyProcess, outputBuffer };
}
