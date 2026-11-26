import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { PASSWORD_TOGGLE, SEARCHABLE_SELECT } from '@/constants/ui';
import { Input, NativeSelect } from './primitives';

const MIN = SEARCHABLE_SELECT.MIN_OPTIONS;

const CITIES = ['Raipur', 'Bhilai', 'Durg', 'Bilaspur', 'Korba', 'Rajnandgaon', 'Jagdalpur', 'Ambikapur', 'Dhamtari'];

const cityOptions = (
  <>
    <option value="">All cities</option>
    {CITIES.map((c, i) => (
      <option key={c} value={i + 1}>
        {c}
      </option>
    ))}
  </>
);

const Controlled = () => {
  const [value, setValue] = React.useState('');
  return (
    <>
      <NativeSelect aria-label="City" value={value} onChange={(e) => setValue(e.target.value)}>
        {cityOptions}
      </NativeSelect>
      <output data-testid="value">{value}</output>
    </>
  );
};

const WithForm = () => {
  const form = useForm<{ cityId: string }>({ defaultValues: { cityId: '3' } });
  const cityId = form.watch('cityId');
  return (
    <>
      <NativeSelect aria-label="City" {...form.register('cityId')}>
        {cityOptions}
      </NativeSelect>
      <output data-testid="value">{cityId}</output>
    </>
  );
};

describe('NativeSelect', () => {
  it('stays a plain select for short lists', () => {
    render(
      <NativeSelect aria-label="Status">
        <option value="A">Active</option>
        <option value="I">Inactive</option>
      </NativeSelect>,
    );
    expect(screen.getByRole('combobox', { name: 'Status' }).tagName).toBe('SELECT');
  });

  it(`adds type-to-search at ${MIN}+ options and reports the pick through onChange`, async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    const field = screen.getByRole('combobox', { name: 'City' });
    expect(field).toHaveValue('');
    expect(field).toHaveAttribute('placeholder', 'All cities');

    // The field itself is the search box.
    await user.click(field);
    await user.type(field, 'bil');
    const hits = screen.getAllByRole('option');
    expect(hits.map((o) => o.textContent)).toEqual(['Bilaspur']);

    await user.keyboard('{Enter}');
    expect(screen.getByTestId('value')).toHaveTextContent('4');
    expect(field).toHaveValue('Bilaspur');
  });

  it('works with react-hook-form register (shows the default, updates on pick)', async () => {
    const user = userEvent.setup();
    render(<WithForm />);
    const field = screen.getByRole('combobox', { name: 'City' });
    expect(field).toHaveValue('Durg');

    await user.click(field);
    // While searching, the current value is shown as the placeholder.
    expect(field).toHaveAttribute('placeholder', 'Durg');
    await user.click(screen.getByRole('option', { name: 'Korba' }));
    expect(screen.getByTestId('value')).toHaveTextContent('5');
    expect(field).toHaveValue('Korba');
  });
});

describe('Input type=password', () => {
  it('shows and hides the password with the eye button', async () => {
    const user = userEvent.setup();
    render(<Input type="password" aria-label="Password" defaultValue="Secret@123" />);
    const field = screen.getByLabelText('Password');
    expect(field).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: PASSWORD_TOGGLE.SHOW }));
    expect(field).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: PASSWORD_TOGGLE.HIDE }));
    expect(field).toHaveAttribute('type', 'password');
  });

  it('can opt out when the page draws its own toggle', () => {
    render(<Input type="password" aria-label="Password" revealToggle={false} />);
    expect(screen.queryByRole('button', { name: PASSWORD_TOGGLE.SHOW })).not.toBeInTheDocument();
  });
});
