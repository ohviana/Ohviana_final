import { todayIst } from '@/lib/format';

interface Props {
  action: string;
  from?: string | undefined;
  to?: string | undefined;
  sort?: string | undefined;
  includeUnavailable?: boolean;
}

/** GET form for date window, sort and sold-out toggle; no JavaScript required. */
export function BatchFilters({ action, from, to, sort, includeUnavailable }: Props) {
  const min = todayIst();
  return (
    <form action={action} method="get" className="form-grid card">
      <div className="field">
        <label htmlFor="bf-from">From</label>
        <input id="bf-from" type="date" name="from" min={min} defaultValue={from} />
      </div>
      <div className="field">
        <label htmlFor="bf-to">To</label>
        <input id="bf-to" type="date" name="to" min={min} defaultValue={to} />
      </div>
      <div className="field">
        <label htmlFor="bf-sort">Sort by</label>
        <select id="bf-sort" name="sort" defaultValue={sort ?? 'departure_asc'}>
          <option value="departure_asc">Soonest first</option>
          <option value="price_asc">Lowest price first</option>
        </select>
      </div>
      <label className="cluster" style={{ fontWeight: 400, minHeight: 44 }}>
        <input
          type="checkbox"
          name="includeUnavailable"
          value="true"
          defaultChecked={includeUnavailable}
          style={{ width: 'auto', minHeight: 0 }}
        />
        Show sold out
      </label>
      <button type="submit" className="secondary">
        Apply
      </button>
    </form>
  );
}
