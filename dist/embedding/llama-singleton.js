/**
 * 共享 node-llama-cpp 单例 — 避免 local.ts 和 summarizer.ts 双重初始化竞争
 *
 * node-llama-cpp 的 getLlama() 是全局 native 绑定操作，必须确保只初始化一次。
 * 本模块提供跨模块共享的 getLlamaOnce()，两个消费者共享同一个 Promise。
 *
 * Fix: Bug 2 — 消除 local.ts / summarizer.ts 重复定义的 _getLlamaPromise
 */
let _getLlamaPromise = null;
export async function getLlamaOnce() {
    if (!_getLlamaPromise) {
        _getLlamaPromise = import('node-llama-cpp').then(m => m.getLlama());
    }
    return _getLlamaPromise;
}
//# sourceMappingURL=llama-singleton.js.map