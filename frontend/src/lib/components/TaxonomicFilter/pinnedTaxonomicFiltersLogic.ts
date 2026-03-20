import { actions, kea, path, reducers, selectors } from 'kea'

import { permanentlyMount } from 'lib/utils/kea-logic-builders'

import { AnyPropertyFilter } from '~/types'

import type { pinnedTaxonomicFiltersLogicType } from './pinnedTaxonomicFiltersLogicType'
import { EXCLUDED_CONTEXT_GROUP_TYPES, matchesFilterEntry } from './taxonomicFilterContext'
import { TaxonomicDefinitionTypes, TaxonomicFilterGroupType, TaxonomicFilterValue } from './types'

export interface PinnedTaxonomicFilter {
    groupType: TaxonomicFilterGroupType
    groupName: string
    value: TaxonomicFilterValue
    item: Record<string, any>
    count: number
    teamId?: number
    propertyFilter?: AnyPropertyFilter
}

export interface PinnedItemContext {
    sourceGroupType: TaxonomicFilterGroupType
    sourceGroupName: string
    count: number
    teamId?: number
    propertyFilter?: AnyPropertyFilter
}

export function hasPinnedContext(item: unknown): item is Record<string, any> & { _pinnedContext: PinnedItemContext } {
    return typeof item === 'object' && item != null && '_pinnedContext' in item && (item as any)._pinnedContext != null
}

export const pinnedTaxonomicFiltersLogic = kea<pinnedTaxonomicFiltersLogicType>([
    path(['lib', 'components', 'TaxonomicFilter', 'pinnedTaxonomicFiltersLogic']),
    actions({
        pinFilter: (
            groupType: TaxonomicFilterGroupType,
            groupName: string,
            value: TaxonomicFilterValue,
            item: any,
            teamId?: number,
            propertyFilter?: AnyPropertyFilter
        ) => ({ groupType, groupName, value, item, teamId, propertyFilter }),
        unpinFilter: (
            groupType: TaxonomicFilterGroupType,
            value: TaxonomicFilterValue,
            propertyFilter?: AnyPropertyFilter
        ) => ({ groupType, value, propertyFilter }),
        incrementPinCount: (
            groupType: TaxonomicFilterGroupType,
            value: TaxonomicFilterValue,
            propertyFilter?: AnyPropertyFilter
        ) => ({ groupType, value, propertyFilter }),
        clearPinnedFilters: true,
    }),
    reducers({
        pinnedFilters: [
            [] as PinnedTaxonomicFilter[],
            { persist: true },
            {
                clearPinnedFilters: () => [],
                pinFilter: (state, { groupType, groupName, value, item, teamId, propertyFilter }) => {
                    if (EXCLUDED_CONTEXT_GROUP_TYPES.has(groupType) || value == null) {
                        return state
                    }
                    if (state.some((f) => matchesFilterEntry(f, groupType, value, propertyFilter))) {
                        return state
                    }
                    const entry: PinnedTaxonomicFilter = {
                        groupType,
                        groupName,
                        value,
                        item,
                        count: 1,
                        ...(teamId ? { teamId } : {}),
                        ...(propertyFilter ? { propertyFilter } : {}),
                    }
                    return [...state, entry]
                },
                unpinFilter: (state, { groupType, value, propertyFilter }) => {
                    return state.filter((f) => !matchesFilterEntry(f, groupType, value, propertyFilter))
                },
                incrementPinCount: (state, { groupType, value, propertyFilter }) => {
                    return state.map((f) =>
                        matchesFilterEntry(f, groupType, value, propertyFilter) ? { ...f, count: f.count + 1 } : f
                    )
                },
            },
        ],
    }),
    selectors({
        sortedPinnedFilters: [
            (s) => [s.pinnedFilters],
            (pinnedFilters: PinnedTaxonomicFilter[]): PinnedTaxonomicFilter[] =>
                [...pinnedFilters].sort((a, b) => b.count - a.count),
        ],
        pinnedFilterItems: [
            (s) => [s.sortedPinnedFilters],
            (sortedPinnedFilters: PinnedTaxonomicFilter[]): TaxonomicDefinitionTypes[] =>
                sortedPinnedFilters.map(
                    (f) =>
                        ({
                            ...f.item,
                            _pinnedContext: {
                                sourceGroupType: f.groupType,
                                sourceGroupName: f.groupName,
                                count: f.count,
                                teamId: f.teamId,
                                propertyFilter: f.propertyFilter,
                            } as PinnedItemContext,
                        }) as unknown as TaxonomicDefinitionTypes
                ),
        ],
        topPinnedItems: [
            (s) => [s.pinnedFilterItems],
            (pinnedFilterItems: TaxonomicDefinitionTypes[]): TaxonomicDefinitionTypes[] =>
                pinnedFilterItems.slice(0, 3),
        ],
        isPinned: [
            (s) => [s.pinnedFilters],
            (pinnedFilters: PinnedTaxonomicFilter[]) =>
                (
                    groupType: TaxonomicFilterGroupType,
                    value: TaxonomicFilterValue,
                    propertyFilter?: AnyPropertyFilter
                ): boolean =>
                    pinnedFilters.some((f) => matchesFilterEntry(f, groupType, value, propertyFilter)),
        ],
    }),
    permanentlyMount(),
])
