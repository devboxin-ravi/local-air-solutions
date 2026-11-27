import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ROW_ACTIONS } from '@/constants/ui';
import { DataTable, RowActions, type Column } from './DataTable';

type Row = { id: number; name: string };

describe('RowActions', () => {
  it('shows only the actions it is given', () => {
    render(<RowActions onView={() => {}} onDelete={() => {}} />);
    expect(screen.getByRole('button', { name: ROW_ACTIONS.VIEW })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ROW_ACTIONS.DELETE })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ROW_ACTIONS.EDIT })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ROW_ACTIONS.CANCEL })).not.toBeInTheDocument();
  });

  it('runs the action without also triggering the row click', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const onDelete = vi.fn();
    const columns: Column<Row>[] = [
      { key: 'name', header: 'Name', cell: (r) => r.name },
      { key: 'actions', header: ROW_ACTIONS.HEADER, cell: () => <RowActions onDelete={onDelete} /> },
    ];
    render(<DataTable columns={columns} rows={[{ id: 1, name: 'Raipur' }]} rowKey={(r) => r.id} onRowClick={onRowClick} />);

    await user.click(screen.getByRole('button', { name: ROW_ACTIONS.DELETE }));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
