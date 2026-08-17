import { z } from 'zod';
import type { ProviderConfig } from '../shared/contracts';

const balanceResponseSchema = z.object({
  is_available: z.boolean(),
  balance_infos: z.array(z.object({
    currency: z.string().min(1),
    total_balance: z.string(),
  })).min(1),
});

export type DeepSeekBalance = {
  available: boolean;
  currency: string;
  totalBalance: number;
};

export async function fetchDeepSeekBalance(
  settings: ProviderConfig,
  apiKey: string,
): Promise<DeepSeekBalance> {
  if (settings.provider !== 'deepseek') throw new Error('当前服务不支持余额查询。');
  const baseURL = (settings.baseURL || 'https://api.deepseek.com').replace(/\/+$/, '');
  const response = await fetch(`${baseURL}/user/balance`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`余额查询失败（HTTP ${response.status}）。`);

  const parsed = balanceResponseSchema.parse(await response.json());
  const info = parsed.balance_infos.find((entry) => entry.currency === 'CNY') ?? parsed.balance_infos[0];
  const totalBalance = Number(info.total_balance);
  if (!Number.isFinite(totalBalance)) throw new Error('余额接口返回了无效金额。');
  return { available: parsed.is_available, currency: info.currency, totalBalance };
}
