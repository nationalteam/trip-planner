/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ItineraryView from '@/components/ItineraryView';

const makeItem = (overrides: Partial<{
  id: string;
  day: number;
  timeBlock: string;
  order: number;
  proposalType: string;
  proposalTitle: string;
  proposalDescription: string;
  proposalCity: string;
  proposalDuration: number | null;
}> = {}) => ({
  id: overrides.id ?? 'item-1',
  day: overrides.day ?? 1,
  timeBlock: overrides.timeBlock ?? 'morning',
  order: overrides.order ?? 0,
  proposal: {
    id: 'proposal-1',
    title: overrides.proposalTitle ?? 'Eiffel Tower',
    description: overrides.proposalDescription ?? 'Iconic landmark',
    type: overrides.proposalType ?? 'place',
    city: overrides.proposalCity ?? 'Paris',
    durationMinutes: overrides.proposalDuration === undefined ? 60 : overrides.proposalDuration,
    suggestedTime: 'morning',
  },
});

describe('ItineraryView', () => {
  it('shows an empty state message when there are no items', () => {
    render(<ItineraryView items={[]} />);
    expect(screen.getByText(/No itinerary items yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Approve proposals to build your itinerary/i)).toBeInTheDocument();
  });

  it('renders a day heading for each day in the itinerary', () => {
    const items = [
      makeItem({ id: 'item-1', day: 1 }),
      makeItem({ id: 'item-2', day: 2 }),
    ];
    render(<ItineraryView items={items} />);
    expect(screen.getByText('Day 1')).toBeInTheDocument();
    expect(screen.getByText('Day 2')).toBeInTheDocument();
  });

  it('renders the proposal title and description', () => {
    const items = [makeItem({ proposalTitle: 'Louvre Museum', proposalDescription: 'World famous art museum' })];
    render(<ItineraryView items={items} />);
    expect(screen.getByText('Louvre Museum')).toBeInTheDocument();
    expect(screen.getByText('World famous art museum')).toBeInTheDocument();
  });

  it('renders the city name for a proposal', () => {
    const items = [makeItem({ proposalCity: 'Paris' })];
    render(<ItineraryView items={items} />);
    expect(screen.getByText('Paris')).toBeInTheDocument();
  });

  it('renders duration when present', () => {
    const items = [makeItem({ proposalDuration: 120 })];
    render(<ItineraryView items={items} />);
    expect(screen.getByText(/120min/)).toBeInTheDocument();
  });

  it('does not render duration when durationMinutes is null', () => {
    const items = [makeItem({ proposalDuration: null })];
    render(<ItineraryView items={items} />);
    expect(screen.queryByText(/min/)).not.toBeInTheDocument();
  });

  it('renders the correct time block label for morning', () => {
    const items = [makeItem({ timeBlock: 'morning' })];
    render(<ItineraryView items={items} />);
    expect(screen.getByText(/Morning/i)).toBeInTheDocument();
  });

  it('renders the correct time block label for afternoon', () => {
    const items = [makeItem({ timeBlock: 'afternoon' })];
    render(<ItineraryView items={items} />);
    expect(screen.getByText(/Afternoon/i)).toBeInTheDocument();
  });

  it('renders the correct time block label for lunch', () => {
    const items = [makeItem({ timeBlock: 'lunch' })];
    render(<ItineraryView items={items} />);
    expect(screen.getByText(/Lunch/i)).toBeInTheDocument();
  });

  it('renders the correct time block label for dinner', () => {
    const items = [makeItem({ timeBlock: 'dinner' })];
    render(<ItineraryView items={items} />);
    expect(screen.getByText(/Evening/i)).toBeInTheDocument();
  });

  it('renders the correct time block label for night', () => {
    const items = [makeItem({ timeBlock: 'night' })];
    render(<ItineraryView items={items} />);
    expect(screen.getByText(/Night/i)).toBeInTheDocument();
  });

  it('groups multiple time blocks within the same day', () => {
    const items = [
      makeItem({ id: 'a', day: 1, timeBlock: 'morning' }),
      makeItem({ id: 'b', day: 1, timeBlock: 'afternoon', proposalTitle: 'Afternoon café' }),
    ];
    render(<ItineraryView items={items} />);
    // Only one Day 1 heading
    expect(screen.getAllByText('Day 1')).toHaveLength(1);
    expect(screen.getByText(/Morning/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Afternoon/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Afternoon café')).toBeInTheDocument();
  });

  it('renders food type icon', () => {
    const items = [makeItem({ proposalType: 'food' })];
    render(<ItineraryView items={items} />);
    expect(screen.getByText('🍽️')).toBeInTheDocument();
  });

  it('renders place type icon', () => {
    const items = [makeItem({ proposalType: 'place' })];
    render(<ItineraryView items={items} />);
    expect(screen.getByText('🏛️')).toBeInTheDocument();
  });

  it('sorts days in ascending order', () => {
    const items = [
      makeItem({ id: 'c', day: 3, proposalTitle: 'Day 3 item' }),
      makeItem({ id: 'a', day: 1, proposalTitle: 'Day 1 item' }),
      makeItem({ id: 'b', day: 2, proposalTitle: 'Day 2 item' }),
    ];
    render(<ItineraryView items={items} />);
    const days = screen.getAllByText(/^Day \d+$/);
    expect(days[0]).toHaveTextContent('Day 1');
    expect(days[1]).toHaveTextContent('Day 2');
    expect(days[2]).toHaveTextContent('Day 3');
  });

  it('renders derived calendar date in day heading when startDate is provided', () => {
    const items = [makeItem({ id: 'item-1', day: 2, proposalTitle: 'Day 2 item' })];
    render(<ItineraryView items={items} schedule={{ startDate: '2026-04-01' }} />);
    expect(screen.getByText(/Day 2 · 2026-04-02/)).toBeInTheDocument();
  });

  it('renders duration progress when durationDays is provided without startDate', () => {
    const items = [makeItem({ id: 'item-1', day: 2, proposalTitle: 'Day 2 item' })];
    render(<ItineraryView items={items} schedule={{ durationDays: 5 }} />);
    expect(screen.getByText('Day 2 / 5 days')).toBeInTheDocument();
  });

  it('renders over-range warning when day exceeds durationDays', () => {
    const items = [makeItem({ id: 'item-1', day: 6, proposalTitle: 'Day 6 item' })];
    render(<ItineraryView items={items} schedule={{ durationDays: 5 }} />);
    expect(screen.getByText('Over planned range')).toBeInTheDocument();
  });

  it('renders empty days up to durationDays even when no items exist on some days', () => {
    const items = [makeItem({ id: 'item-1', day: 1 }), makeItem({ id: 'item-2', day: 3 })];
    render(<ItineraryView items={items} schedule={{ durationDays: 4 }} />);
    expect(screen.getByText('Day 2 / 4 days')).toBeInTheDocument();
    expect(screen.getByText('Day 4 / 4 days')).toBeInTheDocument();
  });

  it('renders empty-day message for days without itinerary items', () => {
    const items = [makeItem({ id: 'item-1', day: 1 })];
    render(<ItineraryView items={items} schedule={{ durationDays: 2 }} />);
    expect(screen.getByText('No items planned for this day yet')).toBeInTheDocument();
  });

  it('renders manually expanded days when durationDays is not set', () => {
    const items = [makeItem({ id: 'item-1', day: 1 })];
    render(<ItineraryView items={items} schedule={{ itineraryVisibleDays: 3 }} />);
    expect(screen.getByText('Day 3')).toBeInTheDocument();
  });
});

describe('ItineraryView drag-and-drop', () => {
  let rafCallbacks: FrameRequestCallback[] = [];
  let requestAnimationFrameSpy: jest.SpyInstance;
  let cancelAnimationFrameSpy: jest.SpyInstance;

  beforeEach(() => {
    rafCallbacks = [];
    requestAnimationFrameSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        rafCallbacks.push(callback);
        return rafCallbacks.length;
      });
    cancelAnimationFrameSpy = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  const makeDndItems = () => [
    makeItem({ id: 'item-1', day: 1, timeBlock: 'morning', proposalTitle: 'Eiffel Tower' }),
    makeItem({ id: 'item-2', day: 1, timeBlock: 'morning', proposalTitle: 'Louvre Museum' }),
  ];

  it('renders items with draggable attribute', () => {
    render(<ItineraryView items={makeDndItems()} onReorder={jest.fn()} />);
    const draggables = document.querySelectorAll('[draggable="true"]');
    expect(draggables.length).toBeGreaterThanOrEqual(2);
  });

  it('calls onReorder with reordered items when drag-and-drop occurs', () => {
    const onReorder = jest.fn();
    render(<ItineraryView items={makeDndItems()} onReorder={onReorder} />);

    const draggables = document.querySelectorAll('[draggable="true"]');
    const source = draggables[0];
    const target = draggables[1];

    fireEvent.dragStart(source, {
      clientY: window.innerHeight - 2,
      dataTransfer: { setData: jest.fn(), effectAllowed: '' },
    });
    fireEvent.dragOver(target, { preventDefault: jest.fn(), dataTransfer: { dropEffect: '' } });
    fireEvent.drop(target, { preventDefault: jest.fn() });

    expect(onReorder).toHaveBeenCalledTimes(1);
    const reordered = onReorder.mock.calls[0][0] as { id: string }[];
    expect(reordered[0].id).toBe('item-2');
    expect(reordered[1].id).toBe('item-1');
  });

  it('does not call onReorder when dropping on the same item', () => {
    const onReorder = jest.fn();
    render(<ItineraryView items={makeDndItems()} onReorder={onReorder} />);

    const draggables = document.querySelectorAll('[draggable="true"]');
    const source = draggables[0];

    fireEvent.dragStart(source, {
      clientY: window.innerHeight - 2,
      dataTransfer: { setData: jest.fn(), effectAllowed: '' },
    });
    fireEvent.dragOver(source, { preventDefault: jest.fn(), dataTransfer: { dropEffect: '' } });
    fireEvent.drop(source, { preventDefault: jest.fn() });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('works without onReorder prop (no crash)', () => {
    render(<ItineraryView items={makeDndItems()} />);

    const draggables = document.querySelectorAll('[draggable="true"]');
    const source = draggables[0];
    const target = draggables[1];

    expect(() => {
      fireEvent.dragStart(source, { dataTransfer: { setData: jest.fn(), effectAllowed: '' } });
      fireEvent.dragOver(target, { preventDefault: jest.fn(), dataTransfer: { dropEffect: '' } });
      fireEvent.drop(target, { preventDefault: jest.fn() });
    }).not.toThrow();
  });

  it('calls onReorder when dropping an item into an empty day', () => {
    const onReorder = jest.fn();
    const items = [makeItem({ id: 'item-1', day: 1, timeBlock: 'morning', proposalTitle: 'Eiffel Tower' })];
    render(<ItineraryView items={items} schedule={{ durationDays: 2 }} onReorder={onReorder} />);

    const source = document.querySelector('[draggable="true"]') as Element;
    const emptyDayDropzone = screen.getByTestId('timeblock-dropzone-2-lunch');

    fireEvent.dragStart(source, { dataTransfer: { setData: jest.fn(), effectAllowed: '' } });
    fireEvent.dragOver(emptyDayDropzone, { preventDefault: jest.fn(), dataTransfer: { dropEffect: '' } });
    fireEvent.drop(emptyDayDropzone, { preventDefault: jest.fn() });

    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith([
      {
        id: 'item-1',
        day: 2,
        timeBlock: 'lunch',
        order: 0,
      },
    ]);
  });

  it('keeps auto-scrolling across frames while dragging near viewport edge', () => {
    render(<ItineraryView items={makeDndItems()} schedule={{ durationDays: 2 }} onReorder={jest.fn()} />);

    const draggables = document.querySelectorAll('[draggable="true"]');
    const source = draggables[0];
    const target = draggables[1];

    fireEvent.dragStart(source, { dataTransfer: { setData: jest.fn(), effectAllowed: '' } });
    fireEvent.dragOver(target, {
      preventDefault: jest.fn(),
      clientY: window.innerHeight - 2,
      dataTransfer: { dropEffect: '' },
    });

    expect(requestAnimationFrameSpy).toHaveBeenCalled();
    expect(rafCallbacks.length).toBeGreaterThan(0);

    const firstFrame = rafCallbacks.shift();
    firstFrame?.(0);
    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(2);

    const secondFrame = rafCallbacks.shift();
    secondFrame?.(16);
    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(3);
  });

  it('stops auto-scroll loop on drag end', () => {
    render(<ItineraryView items={makeDndItems()} schedule={{ durationDays: 2 }} onReorder={jest.fn()} />);

    const draggables = document.querySelectorAll('[draggable="true"]');
    const source = draggables[0];
    const target = draggables[1];

    fireEvent.dragStart(source, { dataTransfer: { setData: jest.fn(), effectAllowed: '' } });
    fireEvent.dragOver(target, {
      preventDefault: jest.fn(),
      clientY: window.innerHeight - 2,
      dataTransfer: { dropEffect: '' },
    });

    const frame = rafCallbacks.shift();
    frame?.(0);
    const beforeDragEndRafCalls = requestAnimationFrameSpy.mock.calls.length;

    fireEvent.dragEnd(source);
    expect(cancelAnimationFrameSpy).toHaveBeenCalled();

    const maybeNextFrame = rafCallbacks.shift();
    maybeNextFrame?.(16);
    expect(requestAnimationFrameSpy.mock.calls.length).toBe(beforeDragEndRafCalls);
  });
});
