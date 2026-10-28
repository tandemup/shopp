/** No native backup until an atomic durable implementation is verified. */
const unsupported=()=>{throw Error('Recuperación nativa pendiente de implementación segura');};
export const createRecoverySnapshot=unsupported;
export const readRecoverySnapshot=unsupported;
export const listRecoverySnapshots=unsupported;
export const previewRecoverySnapshot=unsupported;
