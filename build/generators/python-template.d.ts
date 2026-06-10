/**
 * Python解密脚本模板生成器
 */
export interface ScriptParams {
    algorithm: string;
    key?: string;
    iv?: string;
    mode?: string;
    padding?: string;
    encoding?: string;
    publicKey?: string;
    loginUrl?: string;
    paramName?: string;
    testPlaintext?: string;
    testCiphertext?: string;
}
export declare function generatePythonDecryptScript(params: ScriptParams): string;
export declare function generatePythonEncryptScript(params: ScriptParams): string;
export declare function generatePythonBruteScript(params: ScriptParams): string;
