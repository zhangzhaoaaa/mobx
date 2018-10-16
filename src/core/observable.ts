import {
    ComputedValue,
    IDependencyTree,
    IDerivation,
    IDerivationState,
    TraceMode,
    getDependencyTree,
    globalState,
    runReactions
} from "../internal"

export interface IDepTreeNode {
    name: string
    observing?: IObservable[]
}

export interface IObservable extends IDepTreeNode {
    diffValue: number
    /**
     * 上次访问此可观察到的派生运行的ID
     * 如果这个ID等于当前派生的运行ID，说明依赖已经建立了
     */
    lastAccessedBy: number
    isBeingObserved: boolean

    lowestObserverState: IDerivationState // 避免多余的传播
    isPendingUnobservation: boolean // 把自己push到global.pendingUnobservations中，每批最多一次

    observers: Set<IDerivation>

    onBecomeUnobserved(): void
    onBecomeObserved(): void
}

export function hasObservers(observable: IObservable): boolean {
    return observable.observers && observable.observers.size > 0
}

export function getObservers(observable: IObservable): Set<IDerivation> {
    return observable.observers
}

// function invariantObservers(observable: IObservable) {
//     const list = observable.observers
//     const map = observable.observersIndexes
//     const l = list.length
//     for (let i = 0; i < l; i++) {
//         const id = list[i].__mapid
//         if (i) {
//             invariant(map[id] === i, "INTERNAL ERROR maps derivation.__mapid to index in list") // for performance
//         } else {
//             invariant(!(id in map), "INTERNAL ERROR observer on index 0 shouldn't be held in map.") // for performance
//         }
//     }
//     invariant(
//         list.length === 0 || Object.keys(map).length === list.length - 1,
//         "INTERNAL ERROR there is no junk in map"
//     )
// }
export function addObserver(observable: IObservable, node: IDerivation) {
    // invariant(node.dependenciesState !== -1, "INTERNAL ERROR, can add only dependenciesState !== -1");
    // invariant(observable._observers.indexOf(node) === -1, "INTERNAL ERROR add already added node");
    // invariantObservers(observable);

    observable.observers.add(node)
    if (observable.lowestObserverState > node.dependenciesState)
        observable.lowestObserverState = node.dependenciesState

    // invariantObservers(observable);
    // invariant(observable._observers.indexOf(node) !== -1, "INTERNAL ERROR didn't add node");
}

export function removeObserver(observable: IObservable, node: IDerivation) {
    // invariant(globalState.inBatch > 0, "INTERNAL ERROR, remove should be called only inside batch");
    // invariant(observable._observers.indexOf(node) !== -1, "INTERNAL ERROR remove already removed node");
    // invariantObservers(observable);
    observable.observers.delete(node)
    if (observable.observers.size === 0) {
        // deleting last observer
        queueForUnobservation(observable)
    }
    // invariantObservers(observable);
    // invariant(observable._observers.indexOf(node) === -1, "INTERNAL ERROR remove already removed node2");
}

export function queueForUnobservation(observable: IObservable) {
    if (observable.isPendingUnobservation === false) {
        // invariant(observable._observers.length === 0, "INTERNAL ERROR, should only queue for unobservation unobserved observables");
        observable.isPendingUnobservation = true
        globalState.pendingUnobservations.push(observable)
    }
}

/**
 * Batch starts a transaction, at least for purposes of memoizing ComputedValues when nothing else does.
 * 批处理启动事务，至少在没有其他操作的情况下，用于回溯计算值(ComputedValue)
 * During a batch `onBecomeUnobserved` will be called at most once per observable.
 * 在一次批处理中，onBecomeUnobserved方法在每一次可观察到的值的时候，最多会被调用一次
 * Avoids unnecessary recalculations.
 * 避免没必要的重新计算
 */
export function startBatch() {
    globalState.inBatch++
}

export function endBatch() {
    if (--globalState.inBatch === 0) {
        runReactions()
        // the batch is actually about to finish, all unobserving should happen here.
        // 批处理实际上将要结束，所有的unobserving应该在这里出现
        const list = globalState.pendingUnobservations
        for (let i = 0; i < list.length; i++) {
            const observable = list[i]
            observable.isPendingUnobservation = false
            if (observable.observers.size === 0) {
                if (observable.isBeingObserved) {
                    // if this observable had reactive observers, trigger the hooks
                    // 如果这个可观察的对象有observers，触发hooks
                    observable.isBeingObserved = false
                    observable.onBecomeUnobserved()
                }
                if (observable instanceof ComputedValue) {
                    // computed values are automatically teared down when the last observer leaves
                    // 当最后一个observer离开的时候，computed values会自动地拆解
                    // this process happens recursively, this computed might be the last observabe of another, etc..
                    // 这个过程会递归出现，这个computed可能是另一个的最后一个observable
                    observable.suspend()
                }
            }
        }
        globalState.pendingUnobservations = []
    }
}

export function reportObserved(observable: IObservable): boolean {
    const derivation = globalState.trackingDerivation
    if (derivation !== null) {
        /**
         * Simple optimization, give each derivation run an unique id (runId)
         * 简单优化，给每一个派生一个唯一的id(runid)
         * Check if last time this observable was accessed the same runId is used
         * 检查上次访问此可观测值时是否使用了相同的runId
         * if this is the case, the relation is already known
         * 如果是这样的话，这种关系就已经知道了
         */
        if (derivation.runId !== observable.lastAccessedBy) {
            observable.lastAccessedBy = derivation.runId
            // Tried storing newObserving, or observing, or both as Set, but performance didn't come close...
            // 尝试保存newObserving或者observing，或者两者都保存，但是性能没有接近
            derivation.newObserving![derivation.unboundDepsCount++] = observable
            if (!observable.isBeingObserved) {
                observable.isBeingObserved = true
                observable.onBecomeObserved()
            }
        }
        return true
    } else if (observable.observers.size === 0 && globalState.inBatch > 0) {
        queueForUnobservation(observable)
    }
    return false
}

// function invariantLOS(observable: IObservable, msg: string) {
//     // it's expensive so better not run it in produciton. but temporarily helpful for testing
//     const min = getObservers(observable).reduce((a, b) => Math.min(a, b.dependenciesState), 2)
//     if (min >= observable.lowestObserverState) return // <- the only assumption about `lowestObserverState`
//     throw new Error(
//         "lowestObserverState is wrong for " +
//             msg +
//             " because " +
//             min +
//             " < " +
//             observable.lowestObserverState
//     )
// }

/**
 * NOTE: current propagation mechanism will in case of self reruning autoruns behave unexpectedly
 * 注意：在自重新运行的情况下，当前传播机制会发生意外地行为
 * It will propagate changes to observers from previous run
 * 会从之前的运行中传播变化到observers中
 * It's hard or maybe impossible (with reasonable perf) to get it right with current approach
 * 现行的办法很难或者不太可能使其正确处理
 * Hopefully self reruning autoruns aren't a feature people should depend on
 * 希望自重新运行不是一个人们依赖的feature
 * Also most basic use cases should be ok
 * 大多数基本用例还是可以满足的
 */

// Called by Atom when its value changes
// 当值发生变化的时候，方法会被Atom调用
export function propagateChanged(observable: IObservable) {
    // invariantLOS(observable, "changed start");
    if (observable.lowestObserverState === IDerivationState.STALE) return
    observable.lowestObserverState = IDerivationState.STALE

    // Ideally we use for..of here, but the downcompiled version is really slow...
    // 理论上说我这里可以用for..of，但是降编译版是真的慢
    observable.observers.forEach(d => {
        if (d.dependenciesState === IDerivationState.UP_TO_DATE) {
            if (d.isTracing !== TraceMode.NONE) {
                logTraceInfo(d, observable)
            }
            d.onBecomeStale()
        }
        d.dependenciesState = IDerivationState.STALE
    })
    // invariantLOS(observable, "changed end");
}

// Called by ComputedValue when it recalculate and its value changed
// 当被重新计算和它的值改变的时候，会被ComputedValue调用
export function propagateChangeConfirmed(observable: IObservable) {
    // invariantLOS(observable, "confirmed start");
    if (observable.lowestObserverState === IDerivationState.STALE) return
    observable.lowestObserverState = IDerivationState.STALE

    observable.observers.forEach(d => {
        if (d.dependenciesState === IDerivationState.POSSIBLY_STALE)
            d.dependenciesState = IDerivationState.STALE
        else if (
            d.dependenciesState === IDerivationState.UP_TO_DATE // this happens during computing of `d`, just keep lowestObserverState up to date.
        )
            observable.lowestObserverState = IDerivationState.UP_TO_DATE
    })
    // invariantLOS(observable, "confirmed end");
}

// Used by computed when its dependency changed, but we don't wan't to immediately recompute.
// 当依赖改变的时候，会被computed调用，但是我们不想立即重新计算
export function propagateMaybeChanged(observable: IObservable) {
    // invariantLOS(observable, "maybe start");
    if (observable.lowestObserverState !== IDerivationState.UP_TO_DATE) return
    observable.lowestObserverState = IDerivationState.POSSIBLY_STALE

    observable.observers.forEach(d => {
        if (d.dependenciesState === IDerivationState.UP_TO_DATE) {
            d.dependenciesState = IDerivationState.POSSIBLY_STALE
            if (d.isTracing !== TraceMode.NONE) {
                logTraceInfo(d, observable)
            }
            d.onBecomeStale()
        }
    })
    // invariantLOS(observable, "maybe end");
}

function logTraceInfo(derivation: IDerivation, observable: IObservable) {
    console.log(
        `[mobx.trace] '${derivation.name}' is invalidated due to a change in: '${observable.name}'`
    )
    if (derivation.isTracing === TraceMode.BREAK) {
        const lines = []
        printDepTree(getDependencyTree(derivation), lines, 1)

        // prettier-ignore
        new Function(
`debugger;
/*
Tracing '${derivation.name}'

You are entering this break point because derivation '${derivation.name}' is being traced and '${observable.name}' is now forcing it to update.
Just follow the stacktrace you should now see in the devtools to see precisely what piece of your code is causing this update
The stackframe you are looking for is at least ~6-8 stack-frames up.

${derivation instanceof ComputedValue ? derivation.derivation.toString() : ""}

The dependencies for this derivation are:

${lines.join("\n")}
*/
    `)()
    }
}

function printDepTree(tree: IDependencyTree, lines: string[], depth: number) {
    if (lines.length >= 1000) {
        lines.push("(and many more)")
        return
    }
    lines.push(`${new Array(depth).join("\t")}${tree.name}`) // MWE: not the fastest, but the easiest way :)
    if (tree.dependencies) tree.dependencies.forEach(child => printDepTree(child, lines, depth + 1))
}
