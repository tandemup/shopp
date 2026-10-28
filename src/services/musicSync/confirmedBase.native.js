// Native checkpoint persistence is not implemented: fail closed.
const unsupported=()=>{throw new Error('Bases sincronizadas nativas pendientes de almacenamiento seguro');};
export const readConfirmedBase=unsupported;
export const saveConfirmedBase=unsupported;
export const clearConfirmedBase=unsupported;
