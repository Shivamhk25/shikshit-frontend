import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SearchPicker, type PickerOption } from './SearchPicker';

const people: PickerOption[] = [
  { value: 'a', label: 'Asha Rao (R-1)' },
  { value: 'b', label: 'Asha Rao (R-2)' },
  { value: 'c', label: 'Ravi Khan (R-3)' },
];

function Harness({ initial = '', search, describe }: { initial?: string; search: (q: string) => Promise<PickerOption[]>; describe?: (id: string) => Promise<PickerOption | null> }) {
  const [v, setV] = useState(initial);
  const [n, setN] = useState(0);
  return (
    <>
      <SearchPicker label="Student" required value={v} onChange={setV} search={(q) => search(q)} describe={(id) => (describe ?? (async () => null))(id)} />
      <output data-testid="value">{v}</output>
      <button onClick={() => setN(n + 1)}>other field changed {n}</button>
    </>
  );
}

describe('SearchPicker', () => {
  it('does not fetch again when another field of the form changes', async () => {
    const search = vi.fn(async () => people);
    render(<Harness search={search} />);
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    for (let i = 0; i < 3; i++) await userEvent.click(screen.getByRole('button'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('searches as the person types, tells two people with one name apart, and keeps the choice', async () => {
    const search = vi.fn(async (q: string) => people.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())));
    render(<Harness search={search} />);
    await userEvent.type(screen.getByLabelText('Student *'), 'asha');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Asha Rao (R-2)' })).toBeInTheDocument());
    expect(screen.queryByRole('option', { name: 'Ravi Khan (R-3)' })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Student results'), 'b');
    expect(screen.getByTestId('value')).toHaveTextContent('b');
    expect(search).toHaveBeenLastCalledWith('asha');
  });

  it('names the record already chosen when the form opens on an existing row, and does not loop', async () => {
    const search = vi.fn(async () => people);
    const describe = vi.fn(async (id: string) => people.find((p) => p.value === id) ?? null);
    render(<Harness initial="c" search={search} describe={describe} />);
    await waitFor(() => expect(screen.getByPlaceholderText(/Chosen: Ravi Khan \(R-3\)/)).toBeInTheDocument());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 700));
    });
    expect(describe).toHaveBeenCalledTimes(1);
    expect(search.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('says so when the list cannot be loaded', async () => {
    render(<Harness search={async () => Promise.reject(new Error('down'))} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
  });
});
