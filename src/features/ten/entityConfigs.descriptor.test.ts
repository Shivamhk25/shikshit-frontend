import { describe, expect, it } from 'vitest';
import { blankValues } from '../../crud/descriptor';
import { registry } from '../../shell/registry';
import { NAV_ICONS } from '../../shell/navIcons';
import { entityConfigsDescriptor, type EntityConfig } from './entityConfigs';

const row = {"id":"id-1","configType":"house","code":"RED","name":"Red House","description":null,"sortOrder":1,"status":"active"} as EntityConfig;

describe('entityConfigs descriptor', () => {
  it('uses the ten.entity_configs permissions and the /entity-configs endpoint', () => {
    expect(entityConfigsDescriptor.endpoint).toBe('/entity-configs');
    expect(Object.values(entityConfigsDescriptor.permissions)).toEqual(['view', 'create', 'edit', 'delete'].map((a) => `ten.entity_configs.${a}`));
  });

  it('sends exactly the form fields, and a row round-trips through the form', () => {
    const keys = entityConfigsDescriptor.fields.map((f) => f.key).sort();
    expect(Object.keys(entityConfigsDescriptor.toInput(blankValues(entityConfigsDescriptor.fields))).sort()).toEqual(keys);
    expect(Object.keys(entityConfigsDescriptor.toForm(row)).sort()).toEqual(keys);
    expect(entityConfigsDescriptor.toInput(entityConfigsDescriptor.toForm(row))).toMatchObject({"configType":"house","code":"RED","name":"Red House"});
  });

  it('shows every column for a row and labels it for the delete question', () => {
    for (const c of entityConfigsDescriptor.columns) expect(String(c.render ? c.render(row) : row[c.key as keyof EntityConfig] ?? '')).not.toBe('undefined');
    expect(entityConfigsDescriptor.label(row)).toBe(row.name);
  });

  it('is registered with its permission, path and icon', () => {
    expect(registry.entity_configs?.permission).toBe('ten.entity_configs.view');
    expect(registry.entity_configs?.web?.path).toBe('/entity-configs');
    expect(NAV_ICONS.entity_configs).toBeDefined();
  });
});
