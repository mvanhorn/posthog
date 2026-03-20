import { actions, kea, path, reducers, selectors } from 'kea'

import { now } from 'lib/dayjs'
import { permanentlyMount } from 'lib/utils/kea-logic-builders'

import { AnyPropertyFilter } from '~/types'

import type { recentTaxonomicFiltersLogicType } from './recentTaxonomicFiltersLogicType'
import { EXCLUDED_CONTEXT_GROUP_TYPES, isCompletePropertyFilter, matchesFilterEntry } from './taxonomicFilterContext'
import { TaxonomicDefinitionTypes, TaxonomicFilterGroupType, TaxonomicFilterValue } from './types'

export const MAX_RECENT_FILTERS = 20
export const RECENT_FILTER_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export interface RecentTaxonomicFilter {
    groupType: TaxonomicFilterGroupType
    groupName: string
    value: TaxonomicFilterValue
    item: Record<string, any>
    timestamp: number
    teamId?: number
    propertyFilter?: AnyPropertyFilter
}

export interface RecentItemContext {
    sourceGroupType: TaxonomicFilterGroupType
    sourceGroupName: string
    teamId?: number
    propertyFilter?: AnyPropertyFilter
}

export function hasRecentContext(item: unknown): item is Record<string, any> & { _recentContext: RecentItemContext } {
    return typeof item === 'object' && item != null && '_recentContext' in item && (item as any)._recentContext != null
}

export const recentTaxonomicFiltersLogic = kea<recentTaxonomicFiltersLogicType>([
    path(['lib', 'components', 'TaxonomicFilter', 'recentTaxonomicFiltersLogic']),
    actions({
        recordRecentFilter: (
            groupType: TaxonomicFilterGroupType,
            groupName: string,
            value: TaxonomicFilterValue,
            item: any,
            teamId?: number,
            propertyFilter?: AnyPropertyFilter
        ) => ({
            groupType,
            groupName,
            value,
            item,
            teamId,
            propertyFilter,
        }),
        clearRecentFilters: true,
    }),
    reducers({
        recentFilters: [
            [] as RecentTaxonomicFilter[],
            { persist: true },
            {
                clearRecentFilters: () => [],
                recordRecentFilter: (state, { groupType, groupName, value, item, teamId, propertyFilter }) => {
                    if (EXCLUDED_CONTEXT_GROUP_TYPES.has(groupType) || value == null) {
                        return state
                    }

                    const incomingComplete = isCompletePropertyFilter(propertyFilter)
                    if (
                        !incomingComplete &&
                        state.some(
                            (f) =>
                                f.groupType === groupType &&
                                f.value === value &&
                                isCompletePropertyFilter(f.propertyFilter)
                        )
                    ) {
                        return state
                    }

                    const currentTime = now().valueOf()
                    const cutoff = currentTime - RECENT_FILTER_MAX_AGE_MS

                    const entry: RecentTaxonomicFilter = {
                        groupType,
                        groupName,
                        value,
                        item,
                        timestamp: currentTime,
                        ...(teamId ? { teamId } : {}),
                        ...(propertyFilter ? { propertyFilter } : {}),
                    }

                    const withoutDuplicate = state.filter((f) => {
                        if (f.groupType !== groupType || f.value !== value) {
                            return true
                        }
                        if (incomingComplete && !isCompletePropertyFilter(f.propertyFilter)) {
                            return false
                        }
                        return !matchesFilterEntry(f, groupType, value, propertyFilter)
                    })

                    const withoutExpired = withoutDuplicate.filter((f) => f.timestamp > cutoff)

                    return [entry, ...withoutExpired].slice(0, MAX_RECENT_FILTERS)
                },
            },
        ],
    }),
    selectors({
        recentFilterItems: [
            (s) => [s.recentFilters],
            (recentFilters: RecentTaxonomicFilter[]): TaxonomicDefinitionTypes[] =>
                recentFilters.map(
                    (f) =>
                        ({
                            ...f.item,
                            _recentContext: {
                                sourceGroupType: f.groupType,
                                sourceGroupName: f.groupName,
                                teamId: f.teamId,
                                propertyFilter: f.propertyFilter,
                            } as RecentItemContext,
                        }) as unknown as TaxonomicDefinitionTypes
                ),
        ],
    }),
    permanentlyMount(),
])
