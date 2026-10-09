import { NativeModules, Platform } from 'react-native';
import { UsageSession } from './usage';

type UsageAccessModule = { hasUsageAccess?: () => Promise<boolean>; openUsageAccessSettings?: () => Promise<void>; querySessions?: (startMillis: number, endMillis: number) => Promise<UsageSession[]> };
const UsageAccess: UsageAccessModule | undefined = Platform.OS === 'android' ? NativeModules.UsageAccess : undefined;
export async function hasUsageAccess() { return Platform.OS === 'android' && Boolean(await UsageAccess?.hasUsageAccess?.()); }
export async function openUsageAccessSettings() { if (Platform.OS === 'android') await UsageAccess?.openUsageAccessSettings?.(); }
export async function queryNativeSessions(startMillis: number, endMillis: number) { if (Platform.OS !== 'android') return []; return (await UsageAccess?.querySessions?.(startMillis, endMillis)) ?? []; }
