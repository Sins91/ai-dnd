import { access, readFile, unlink, writeFile } from 'node:fs/promises';
import { safeStorage } from 'electron';

export class CredentialStore {
  constructor(private readonly path: string) {}

  async hasSecret(): Promise<boolean> {
    try { await access(this.path); return true; } catch { return false; }
  }

  async save(secret: string): Promise<void> {
    const value = secret.trim();
    if (!value) throw new Error('API Key 不能为空。');
    if (!/^[\x21-\x7E]+$/.test(value)) {
      throw new Error('API Key 只能包含半角 ASCII 字符，且不能包含空格。');
    }
    if (!safeStorage.isEncryptionAvailable()) throw new Error('当前系统没有可用的安全密钥存储。');
    await writeFile(this.path, safeStorage.encryptString(value), { mode: 0o600 });
  }

  async read(): Promise<string | null> {
    if (!(await this.hasSecret()) || !safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.decryptString(await readFile(this.path));
  }

  async clear(): Promise<void> {
    try { await unlink(this.path); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
