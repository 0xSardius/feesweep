/**
 * FeeSweep keeper — accrual detection, tx composing, alert dispatch.
 * Week 1: Telegram accrual alerts (this process) + aggregate metrics job
 * (`pnpm job:aggregate`). Week 2: policy triggers → propose-then-sign bundles.
 */
import { runAlertLoop } from "./alerts";

await runAlertLoop();
