import { isOperatorFlag } from 'lib/utils'

import { AnyPropertyFilter } from '~/types'

import { TaxonomicFilterGroupType, TaxonomicFilterValue } from './types'

export const EXCLUDED_CONTEXT_GROUP_TYPES = new Set<TaxonomicFilterGroupType>([
    TaxonomicFilterGroupType.HogQLExpression,
    TaxonomicFilterGroupType.SuggestedFilters,
    TaxonomicFilterGroupType.RecentFilters,
    TaxonomicFilterGroupType.Empty,
    TaxonomicFilterGroupType.Wildcards,
    TaxonomicFilterGroupType.MaxAIContext,
])

export interface BaseItemContext {
    sourceGroupType: TaxonomicFilterGroupType
    sourceGroupName: string
    teamId?: number
    propertyFilter?: AnyPropertyFilter
}

export function isCompletePropertyFilter(propertyFilter: AnyPropertyFilter | undefined): boolean {
    if (!propertyFilter) {
        return false
    }
    const hasValue =
        'value' in propertyFilter &&
        propertyFilter.value != null &&
        !(Array.isArray(propertyFilter.value) && propertyFilter.value.length === 0)
    const op = 'operator' in propertyFilter ? propertyFilter.operator : undefined
    return hasValue || (!!op && isOperatorFlag(op))
}

export function matchesFilterEntry(
    existing: { groupType: TaxonomicFilterGroupType; value: TaxonomicFilterValue; propertyFilter?: AnyPropertyFilter },
    groupType: TaxonomicFilterGroupType,
    value: TaxonomicFilterValue,
    propertyFilter?: AnyPropertyFilter
): boolean {
    if (existing.groupType !== groupType || existing.value !== value) {
        return false
    }
    const existingComplete = isCompletePropertyFilter(existing.propertyFilter)
    const incomingComplete = isCompletePropertyFilter(propertyFilter)
    if (!existingComplete && !incomingComplete) {
        return true
    }
    if (existingComplete !== incomingComplete) {
        return false
    }
    if (existing.propertyFilter && propertyFilter) {
        const eOp = 'operator' in existing.propertyFilter ? existing.propertyFilter.operator : undefined
        const eVal = 'value' in existing.propertyFilter ? existing.propertyFilter.value : undefined
        const iOp = 'operator' in propertyFilter ? propertyFilter.operator : undefined
        const iVal = 'value' in propertyFilter ? propertyFilter.value : undefined
        return eOp === iOp && JSON.stringify(eVal) === JSON.stringify(iVal)
    }
    return true
}

export interface ItemContextInfo {
    source: 'pinned' | 'recent'
    sourceGroupType: TaxonomicFilterGroupType
    sourceGroupName: string
    propertyFilter?: AnyPropertyFilter
    teamId?: number
}

export function getItemContext(item: unknown): ItemContextInfo | null {
    if (hasPinnedContextRaw(item)) {
        const ctx = (item as any)._pinnedContext
        return {
            source: 'pinned',
            sourceGroupType: ctx.sourceGroupType,
            sourceGroupName: ctx.sourceGroupName,
            propertyFilter: ctx.propertyFilter,
            teamId: ctx.teamId,
        }
    }
    if (hasRecentContextRaw(item)) {
        const ctx = (item as any)._recentContext
        return {
            source: 'recent',
            sourceGroupType: ctx.sourceGroupType,
            sourceGroupName: ctx.sourceGroupName,
            propertyFilter: ctx.propertyFilter,
            teamId: ctx.teamId,
        }
    }
    return null
}

export function stripContext<T extends Record<string, any>>(item: T): T {
    const { _pinnedContext: _p, _recentContext: _r, ...clean } = item
    return clean as T
}

function hasPinnedContextRaw(item: unknown): boolean {
    return typeof item === 'object' && item != null && '_pinnedContext' in item && (item as any)._pinnedContext != null
}

function hasRecentContextRaw(item: unknown): boolean {
    return typeof item === 'object' && item != null && '_recentContext' in item && (item as any)._recentContext != null
}
