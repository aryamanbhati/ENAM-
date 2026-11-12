-- Seed: demo portfolio (19 companies, weights sum to 100) and default triggers.
-- Generated from BSE's scrip list (worker/fixtures/bse_scrips.json).

insert into companies (nse_symbol, bse_code, isin, name, sector, yahoo_symbol) values
  ('RELIANCE', '500325', 'INE002A01018', 'Reliance Industries Ltd', 'Energy and conglomerate', 'RELIANCE.NS'),
  ('HDFCBANK', '500180', 'INE040A01034', 'HDFC Bank Ltd.', 'Banking', 'HDFCBANK.NS'),
  ('ICICIBANK', '532174', 'INE090A01021', 'ICICI Bank Ltd.', 'Banking', 'ICICIBANK.NS'),
  ('INFY', '500209', 'INE009A01021', 'Infosys Ltd', 'IT services', 'INFY.NS'),
  ('BHARTIARTL', '532454', 'INE397D01024', 'Bharti Airtel Ltd.', 'Telecom', 'BHARTIARTL.NS'),
  ('LT', '500510', 'INE018A01030', 'Larsen & Toubro Limited', 'Engineering and construction', 'LT.NS'),
  ('BAJFINANCE', '500034', 'INE296A01032', 'Bajaj Finance Limited', 'Consumer finance', 'BAJFINANCE.NS'),
  ('TITAN', '500114', 'INE280A01028', 'Titan Company Limited', 'Consumer retail', 'TITAN.NS'),
  ('SUNPHARMA', '524715', 'INE044A01036', 'Sun Pharmaceutical Industries Ltd.', 'Pharmaceuticals', 'SUNPHARMA.NS'),
  ('TATASTEEL', '500470', 'INE081A01020', 'TATA STEEL LIMITED', 'Metals', 'TATASTEEL.NS'),
  ('ASIANPAINT', '500820', 'INE021A01026', 'Asian Paints Ltd.', 'Consumer goods', 'ASIANPAINT.NS'),
  ('CIPLA', '500087', 'INE059A01026', 'Cipla Ltd.', 'Pharmaceuticals', 'CIPLA.NS'),
  ('LUPIN', '500257', 'INE326A01037', 'Lupin Ltd', 'Pharmaceuticals', 'LUPIN.NS'),
  ('TRENT', '500251', 'INE849A01020', 'Trent Ltd [Lakme Ltd]', 'Consumer retail', 'TRENT.NS'),
  ('DIXON', '540699', 'INE935N01020', 'Dixon Technologies (India) Limited', 'Electronics manufacturing', 'DIXON.NS'),
  ('PERSISTENT', '533179', 'INE262H01021', 'Persistent Systems Limited', 'IT services', 'PERSISTENT.NS'),
  ('KPITTECH', '542651', 'INE04I401011', 'KPIT Technologies Ltd', 'Automotive software', 'KPITTECH.NS'),
  ('SUZLON', '532667', 'INE040H01021', 'SUZLON ENERGY LTD.', 'Renewable energy', 'SUZLON.NS'),
  ('IDEA', '532822', 'INE669E01016', 'VODAFONE IDEA  LIMITED', 'Telecom', 'IDEA.NS')
on conflict (nse_symbol) do update set bse_code=excluded.bse_code, isin=excluded.isin, name=excluded.name, sector=excluded.sector, yahoo_symbol=excluded.yahoo_symbol;

insert into holdings (company_id, weight)
select c.id, v.w from (values
  ('RELIANCE', 10),
  ('HDFCBANK', 9),
  ('ICICIBANK', 7),
  ('INFY', 7),
  ('BHARTIARTL', 6),
  ('LT', 6),
  ('BAJFINANCE', 6),
  ('TITAN', 5),
  ('SUNPHARMA', 5),
  ('TATASTEEL', 5),
  ('ASIANPAINT', 4),
  ('CIPLA', 4),
  ('LUPIN', 4),
  ('TRENT', 4),
  ('DIXON', 4),
  ('PERSISTENT', 4),
  ('KPITTECH', 4),
  ('SUZLON', 3),
  ('IDEA', 3)
) as v(sym, w) join companies c on c.nse_symbol = v.sym
on conflict (company_id) do update set weight = excluded.weight;

insert into triggers (id, categories, volume_multiple, price_pct, digest_time) values
  (1, '{"results": true, "M&A": true, "management_change": true, "fund_raise": true, "litigation": true, "credit_rating": false, "capex": false, "pledging": true, "insider_trading": false, "dividend": false, "bonus_split": false}', 2, 5, '08:30')
on conflict (id) do nothing;
