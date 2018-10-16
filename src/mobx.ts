/**
 * (c) Michel Weststrate 2015 - 2018
 * MIT Licensed
 *
 * 欢迎光临mobx的源码！想要了解Mobx的内部工作机制，这篇文章是个好的开始:
 * https://medium.com/@mweststrate/becoming-fully-reactive-an-in-depth-explanation-of-mobservable-55995262a254#.xvbh6qd74
 *
 * 源码文件夹:
 * ===============
 *
 * - api/     模块暴露的大多数公共的静态方法能在这里找到
 * - core/    Mobx 算法的实现;atoms（原子），derivation（派生），reactions（响应），dependency tree（依赖树）, optimizations（优化）.很酷的东西可以在这里找到。
 * - types/   需要可观察的对象、数组和值的数据类型都在这个文件夹下。包含像'asFlat'这样的修改器
 * - utils/   工具.
 *
 */

if (typeof Proxy === "undefined" || typeof Symbol === "undefined") {
    // 使用Mobx 5+需要Proxy和Symbol对象的支持。如果你的环境不支持Proxy对象，请降级到Mobx 4.使用React Native Android的用户，考虑升级一下JSCore.
    throw new Error(
        "[mobx] MobX 5+ requires Proxy and Symbol objects. If your environment doesn't support Proxy objects, please downgrade to MobX 4. For React Native Android, consider upgrading JSCore."
    )
}

declare var window: any
try {
    // 定义process.env
    // if this is not a production build in the first place
    // (in which case the expression below would be substituted with 'production')
    process.env.NODE_ENV
} catch (e) {
    var g = typeof window !== "undefined" ? window : global
    if (typeof process === "undefined") g.process = {}
    g.process.env = {}
}

;(() => {
    function testCodeMinification() {}
    if (
        testCodeMinification.name !== "testCodeMinification" &&
        process.env.NODE_ENV !== "production"
    ) {
        console.warn(
            // Template literal(backtick) is used for fix issue with rollup-plugin-commonjs https://github.com/rollup/rollup-plugin-commonjs/issues/344
            `[mobx] you are running a minified build, but 'process.env.NODE_ENV' was not set to 'production' in your bundler. This results in an unnecessarily large and slow bundle`
        )
    }
})()

export {
    IObservable,
    IDepTreeNode,
    Reaction,
    IReactionPublic,
    IReactionDisposer,
    IDerivation,
    untracked,
    IDerivationState,
    IAtom,
    createAtom,
    IAction,
    spy,
    IComputedValue,
    IEqualsComparer,
    comparer,
    IEnhancer,
    IInterceptable,
    IInterceptor,
    IListenable,
    IObjectWillChange,
    IObjectDidChange,
    IObservableObject,
    isObservableObject,
    IValueDidChange,
    IValueWillChange,
    IObservableValue,
    isObservableValue as isBoxedObservable,
    IObservableArray,
    IArrayWillChange,
    IArrayWillSplice,
    IArrayChange,
    IArraySplice,
    isObservableArray,
    IKeyValueMap,
    ObservableMap,
    IMapEntries,
    IMapEntry,
    IMapWillChange,
    IMapDidChange,
    isObservableMap,
    IObservableMapInitialValues,
    transaction,
    observable,
    IObservableFactory,
    IObservableFactories,
    computed,
    IComputed,
    isObservable,
    isObservableProp,
    isComputed,
    isComputedProp,
    extendObservable,
    observe,
    intercept,
    autorun,
    IAutorunOptions,
    reaction,
    IReactionOptions,
    when,
    IWhenOptions,
    action,
    isAction,
    runInAction,
    IActionFactory,
    keys,
    values,
    entries,
    set,
    remove,
    has,
    get,
    decorate,
    configure,
    onBecomeObserved,
    onBecomeUnobserved,
    flow,
    toJS,
    trace,
    IObserverTree,
    IDependencyTree,
    getDependencyTree,
    getObserverTree,
    resetGlobalState as _resetGlobalState,
    getGlobalState as _getGlobalState,
    getDebugName,
    getAtom,
    getAdministration as _getAdministration,
    allowStateChanges as _allowStateChanges,
    allowStateChangesInsideComputed as _allowStateChangesInsideComputed,
    Lambda,
    isArrayLike,
    $mobx,
    isComputingDerivation as _isComputingDerivation,
    onReactionError,
    interceptReads as _interceptReads,
    IComputedValueOptions
} from "./internal"

// Devtools support
import { spy, getDebugName, $mobx } from "./internal"

declare var __MOBX_DEVTOOLS_GLOBAL_HOOK__: { injectMobx: ((any) => void) }
if (typeof __MOBX_DEVTOOLS_GLOBAL_HOOK__ === "object") {
    // See: https://github.com/andykog/mobx-devtools/
    __MOBX_DEVTOOLS_GLOBAL_HOOK__.injectMobx({
        spy,
        extras: {
            getDebugName
        },
        $mobx
    })
}
