import { initKeaTests } from '~/test/init'
import { PropertyFilterType, PropertyOperator } from '~/types'

import { pinnedTaxonomicFiltersLogic } from './pinnedTaxonomicFiltersLogic'
import { TaxonomicFilterGroupType } from './types'

describe('pinnedTaxonomicFiltersLogic', () => {
    let logic: ReturnType<typeof pinnedTaxonomicFiltersLogic.build>

    beforeEach(() => {
        localStorage.clear()
        initKeaTests()
        logic = pinnedTaxonomicFiltersLogic.build()
        logic.mount()
    })

    afterEach(() => {
        logic.unmount()
    })

    it('starts with an empty list', () => {
        expect(logic.values.pinnedFilters).toEqual([])
    })

    describe('pinFilter', () => {
        it('adds an item with count 1', () => {
            logic.actions.pinFilter(TaxonomicFilterGroupType.Events, 'Events', '$pageview', { name: '$pageview' })

            const filters = logic.values.pinnedFilters
            expect(filters).toHaveLength(1)
            expect(filters[0]).toEqual(
                expect.objectContaining({
                    groupType: TaxonomicFilterGroupType.Events,
                    groupName: 'Events',
                    value: '$pageview',
                    count: 1,
                })
            )
        })

        it('does not duplicate an already-pinned item', () => {
            logic.actions.pinFilter(TaxonomicFilterGroupType.Events, 'Events', '$pageview', { name: '$pageview' })
            logic.actions.pinFilter(TaxonomicFilterGroupType.Events, 'Events', '$pageview', { name: '$pageview' })

            expect(logic.values.pinnedFilters).toHaveLength(1)
        })

        it('allows the same value in different group types', () => {
            logic.actions.pinFilter(TaxonomicFilterGroupType.Events, 'Events', 'name', { name: 'name' })
            logic.actions.pinFilter(TaxonomicFilterGroupType.PersonProperties, 'Person properties', 'name', {
                name: 'name',
            })

            expect(logic.values.pinnedFilters).toHaveLength(2)
        })

        it('stores teamId and propertyFilter when provided', () => {
            const propertyFilter = {
                type: PropertyFilterType.Event,
                key: '$browser',
                operator: PropertyOperator.Exact,
                value: 'Chrome',
            }
            logic.actions.pinFilter(
                TaxonomicFilterGroupType.EventProperties,
                'Event properties',
                '$browser',
                { name: '$browser' },
                42,
                propertyFilter
            )

            expect(logic.values.pinnedFilters[0].teamId).toBe(42)
            expect(logic.values.pinnedFilters[0].propertyFilter).toEqual(propertyFilter)
        })

        it('keeps property filters with same key but different values as separate pins', () => {
            logic.actions.pinFilter(
                TaxonomicFilterGroupType.EventProperties,
                'Event properties',
                '$browser',
                { name: '$browser' },
                undefined,
                { type: PropertyFilterType.Event, key: '$browser', operator: PropertyOperator.Exact, value: 'Chrome' }
            )
            logic.actions.pinFilter(
                TaxonomicFilterGroupType.EventProperties,
                'Event properties',
                '$browser',
                { name: '$browser' },
                undefined,
                { type: PropertyFilterType.Event, key: '$browser', operator: PropertyOperator.Exact, value: 'Safari' }
            )

            expect(logic.values.pinnedFilters).toHaveLength(2)
        })

        it.each([
            { groupType: TaxonomicFilterGroupType.HogQLExpression, description: 'HogQLExpression' },
            { groupType: TaxonomicFilterGroupType.SuggestedFilters, description: 'SuggestedFilters' },
            { groupType: TaxonomicFilterGroupType.RecentFilters, description: 'RecentFilters' },
            { groupType: TaxonomicFilterGroupType.Empty, description: 'Empty' },
            { groupType: TaxonomicFilterGroupType.Wildcards, description: 'Wildcards' },
            { groupType: TaxonomicFilterGroupType.MaxAIContext, description: 'MaxAIContext' },
        ])('ignores pins from excluded group type: $description', ({ groupType }) => {
            logic.actions.pinFilter(groupType, 'Ignored', 'some-value', { name: 'some-value' })
            expect(logic.values.pinnedFilters).toHaveLength(0)
        })

        it('ignores pins with null value', () => {
            logic.actions.pinFilter(TaxonomicFilterGroupType.Events, 'Events', null, { name: 'All events' })
            expect(logic.values.pinnedFilters).toHaveLength(0)
        })
    })

    describe('unpinFilter', () => {
        it('removes a pinned item', () => {
            logic.actions.pinFilter(TaxonomicFilterGroupType.Events, 'Events', '$pageview', { name: '$pageview' })
            logic.actions.pinFilter(TaxonomicFilterGroupType.Events, 'Events', '$click', { name: '$click' })

            logic.actions.unpinFilter(TaxonomicFilterGroupType.Events, '$pageview')

            expect(logic.values.pinnedFilters).toHaveLength(1)
            expect(logic.values.pinnedFilters[0].value).toBe('$click')
        })

        it('removes a pinned property filter by matching operator and value', () => {
            const propertyFilter = {
                type: PropertyFilterType.Event,
                key: '$browser',
                operator: PropertyOperator.Exact,
                value: 'Chrome',
            }
            logic.actions.pinFilter(
                TaxonomicFilterGroupType.EventProperties,
                'Event properties',
                '$browser',
                { name: '$browser' },
                undefined,
                propertyFilter
            )

            logic.actions.unpinFilter(TaxonomicFilterGroupType.EventProperties, '$browser', propertyFilter)

            expect(logic.values.pinnedFilters).toHaveLength(0)
        })
    })

    describe('incrementPinCount', () => {
        it('increments the count of a matching pinned item', () => {
            logic.actions.pinFilter(TaxonomicFilterGroupType.Events, 'Events', '$pageview', { name: '$pageview' })
            expect(logic.values.pinnedFilters[0].count).toBe(1)

            logic.actions.incrementPinCount(TaxonomicFilterGroupType.Events, '$pageview')
            expect(logic.values.pinnedFilters[0].count).toBe(2)

            logic.actions.incrementPinCount(TaxonomicFilterGroupType.Events, '$pageview')
            expect(logic.values.pinnedFilters[0].count).toBe(3)
        })

        it('does not affect non-matching items', () => {
            logic.actions.pinFilter(TaxonomicFilterGroupType.Events, 'Events', '$pageview', { name: '$pageview' })
            logic.actions.pinFilter(TaxonomicFilterGroupType.Events, 'Events', '$click', { name: '$click' })

            logic.actions.incrementPinCount(TaxonomicFilterGroupType.Events, '$pageview')

            expect(logic.values.pinnedFilters.find((f) => f.value === '$pageview')?.count).toBe(2)
            expect(logic.values.pinnedFilters.find((f) => f.value === '$click')?.count).toBe(1)
        })
    })

    describe('sortedPinnedFilters', () => {
        it('sorts by count descending', () => {
            logic.actions.pinFilter(TaxonomicFilterGroupType.Events, 'Events', 'low', { name: 'low' })
            logic.actions.pinFilter(TaxonomicFilterGroupType.Events, 'Events', 'high', { name: 'high' })

            logic.actions.incrementPinCount(TaxonomicFilterGroupType.Events, 'high')
            logic.actions.incrementPinCount(TaxonomicFilterGroupType.Events, 'high')

            const sorted = logic.values.sortedPinnedFilters
            expect(sorted[0].value).toBe('high')
            expect(sorted[0].count).toBe(3)
            expect(sorted[1].value).toBe('low')
            expect(sorted[1].count).toBe(1)
        })
    })

    describe('pinnedFilterItems', () => {
        it('maps filters to items with _pinnedContext', () => {
            logic.actions.pinFilter(TaxonomicFilterGroupType.Events, 'Events', '$pageview', {
                name: '$pageview',
                id: 'uuid-1',
            })

            const items = logic.values.pinnedFilterItems
            expect(items).toHaveLength(1)
            expect((items[0] as any)._pinnedContext).toEqual(
                expect.objectContaining({
                    sourceGroupType: TaxonomicFilterGroupType.Events,
                    sourceGroupName: 'Events',
                    count: 1,
                })
            )
        })
    })

    describe('topPinnedItems', () => {
        it('returns top 3 items by count', () => {
            for (let i = 0; i < 5; i++) {
                logic.actions.pinFilter(TaxonomicFilterGroupType.Events, 'Events', `event-${i}`, {
                    name: `event-${i}`,
                })
            }
            for (let i = 0; i < 5; i++) {
                logic.actions.incrementPinCount(TaxonomicFilterGroupType.Events, `event-${4 - i}`)
            }

            const top = logic.values.topPinnedItems
            expect(top).toHaveLength(3)
        })
    })

    describe('isPinned', () => {
        it('returns true for pinned items', () => {
            logic.actions.pinFilter(TaxonomicFilterGroupType.Events, 'Events', '$pageview', { name: '$pageview' })

            expect(logic.values.isPinned(TaxonomicFilterGroupType.Events, '$pageview')).toBe(true)
        })

        it('returns false for non-pinned items', () => {
            expect(logic.values.isPinned(TaxonomicFilterGroupType.Events, '$pageview')).toBe(false)
        })

        it('matches property filters correctly', () => {
            const propertyFilter = {
                type: PropertyFilterType.Event,
                key: '$browser',
                operator: PropertyOperator.Exact,
                value: 'Chrome',
            }
            logic.actions.pinFilter(
                TaxonomicFilterGroupType.EventProperties,
                'Event properties',
                '$browser',
                { name: '$browser' },
                undefined,
                propertyFilter
            )

            expect(logic.values.isPinned(TaxonomicFilterGroupType.EventProperties, '$browser', propertyFilter)).toBe(
                true
            )
            expect(
                logic.values.isPinned(TaxonomicFilterGroupType.EventProperties, '$browser', {
                    ...propertyFilter,
                    value: 'Safari',
                })
            ).toBe(false)
        })
    })

    describe('clearPinnedFilters', () => {
        it('removes all pinned items', () => {
            logic.actions.pinFilter(TaxonomicFilterGroupType.Events, 'Events', '$pageview', { name: '$pageview' })
            logic.actions.pinFilter(TaxonomicFilterGroupType.Events, 'Events', '$click', { name: '$click' })

            logic.actions.clearPinnedFilters()

            expect(logic.values.pinnedFilters).toHaveLength(0)
        })
    })
})
