import '@testing-library/jest-dom'

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'kea'

import { FEATURE_FLAGS } from 'lib/constants'
import { featureFlagLogic } from 'lib/logic/featureFlagLogic'

import { useMocks } from '~/mocks/jest'
import { actionsModel } from '~/models/actionsModel'
import { groupsModel } from '~/models/groupsModel'
import { initKeaTests } from '~/test/init'
import { mockGetEventDefinitions, mockGetPropertyDefinitions } from '~/test/mocks'

import { pinnedTaxonomicFiltersLogic } from './pinnedTaxonomicFiltersLogic'
import { TaxonomicFilter } from './TaxonomicFilter'
import { TaxonomicFilterGroupType } from './types'

jest.mock('lib/components/AutoSizer', () => ({
    AutoSizer: ({ renderProp }: { renderProp: (size: { height: number; width: number }) => React.ReactNode }) =>
        renderProp({ height: 400, width: 400 }),
}))

describe('TaxonomicFilter pinned items', () => {
    let onChangeMock: jest.Mock
    let pinnedLogic: ReturnType<typeof pinnedTaxonomicFiltersLogic.build>

    function enablePinnedFlag(): void {
        const ffLogic = featureFlagLogic()
        ffLogic.mount()
        ffLogic.actions.setFeatureFlags([FEATURE_FLAGS.TAXONOMIC_FILTER_PINNED], {
            [FEATURE_FLAGS.TAXONOMIC_FILTER_PINNED]: true,
        })
    }

    function mountPinnedLogic(): void {
        pinnedLogic = pinnedTaxonomicFiltersLogic.build()
        pinnedLogic.mount()
    }

    function pinEvent(name: string): void {
        mountPinnedLogic()
        pinnedLogic.actions.pinFilter(TaxonomicFilterGroupType.Events, 'Events', name, { id: name, name })
    }

    beforeEach(() => {
        onChangeMock = jest.fn()
        localStorage.clear()
        useMocks({
            get: {
                '/api/projects/:team/event_definitions': mockGetEventDefinitions,
                '/api/projects/:team/property_definitions': mockGetPropertyDefinitions,
                '/api/projects/:team/actions': { results: [] },
                '/api/environments/:team/persons/properties': [],
            },
            post: {
                '/api/environments/:team/query': { results: [] },
            },
        })
        initKeaTests()
        actionsModel.mount()
        groupsModel.mount()
    })

    afterEach(() => {
        cleanup()
    })

    function renderFilter(
        props: Partial<React.ComponentProps<typeof TaxonomicFilter>> = {}
    ): ReturnType<typeof render> {
        return render(
            <Provider>
                <TaxonomicFilter
                    taxonomicGroupTypes={[TaxonomicFilterGroupType.Events]}
                    onChange={onChangeMock}
                    {...props}
                />
            </Provider>
        )
    }

    describe('when the feature flag is enabled', () => {
        it('shows pinned items at the top of their group', async () => {
            enablePinnedFlag()
            pinEvent('$click')

            renderFilter()

            await waitFor(() => {
                expect(screen.getByTestId('prop-filter-events-0')).toBeInTheDocument()
            })

            expect(screen.getByTestId('prop-filter-events-0').textContent).toContain('$click')
        })

        it('renders a pin icon on pinned items', async () => {
            enablePinnedFlag()
            pinEvent('$click')

            renderFilter()

            await waitFor(() => {
                expect(screen.getByTestId('prop-filter-events-0')).toBeInTheDocument()
            })

            expect(
                screen.getByTestId('prop-filter-events-0').querySelector('[data-testid="pin-icon"]')
            ).toBeInTheDocument()
        })

        it('does not render a pin icon on regular items', async () => {
            enablePinnedFlag()
            mountPinnedLogic()

            renderFilter()

            await waitFor(() => {
                expect(screen.getByTestId('prop-filter-events-0')).toBeInTheDocument()
            })

            expect(
                screen.getByTestId('prop-filter-events-0').querySelector('[data-testid="pin-icon"]')
            ).not.toBeInTheDocument()
        })
    })

    describe('when the feature flag is disabled', () => {
        it('does not prepend pinned items to the list', async () => {
            pinEvent('$click')

            renderFilter()

            await waitFor(() => {
                expect(screen.getByTestId('prop-filter-events-0')).toBeInTheDocument()
            })

            expect(screen.getByTestId('prop-filter-events-0').textContent).not.toContain('$click')
        })
    })

    describe('deduplication', () => {
        it('does not show remote items that duplicate pinned items', async () => {
            enablePinnedFlag()
            pinEvent('event1')

            renderFilter()

            await waitFor(() => {
                expect(screen.getByTestId('prop-filter-events-0')).toBeInTheDocument()
            })

            expect(screen.getByTestId('prop-filter-events-0').textContent).toContain('event1')

            const allRows = screen.queryAllByTestId(/^prop-filter-events-/)
            const event1Occurrences = allRows.filter((row) => row.textContent?.includes('event1'))
            expect(event1Occurrences).toHaveLength(1)
        })
    })

    describe('increment count on selection', () => {
        it('increments the pin count when a pinned item is selected', async () => {
            enablePinnedFlag()
            pinEvent('$click')

            expect(pinnedLogic.values.pinnedFilters[0].count).toBe(1)

            renderFilter()

            await waitFor(() => {
                expect(screen.getByTestId('prop-filter-events-0')).toBeInTheDocument()
                expect(screen.getByTestId('prop-filter-events-0').textContent).toContain('$click')
            })

            await userEvent.click(screen.getByTestId('prop-filter-events-0'))

            await waitFor(() => {
                expect(onChangeMock).toHaveBeenCalledTimes(1)
            })

            expect(pinnedLogic.values.pinnedFilters[0].count).toBe(2)
        })
    })
})
