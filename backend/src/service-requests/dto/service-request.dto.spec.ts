import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateServiceRequestDto } from './service-request.dto';

const base = { categoryId: 'cat', subCategoryId: 'sub', message: 'Leaking pipe' };
const errorsFor = async (body: object) =>
  (await validate(plainToInstance(CreateServiceRequestDto, body), { whitelist: true, forbidNonWhitelisted: true })).map(e => e.property);

describe('CreateServiceRequestDto location rules', () => {
  it('rejects a request without townId', async () => {
    expect(await errorsFor(base)).toContain('townId');
  });

  it('rejects an empty townId', async () => {
    expect(await errorsFor({ ...base, townId: '' })).toContain('townId');
  });

  it('accepts a town without a suburb', async () => {
    expect(await errorsFor({ ...base, townId: 't-jhb' })).toEqual([]);
  });

  it('accepts a town with a suburb', async () => {
    expect(await errorsFor({ ...base, townId: 't-jhb', suburbId: 's-san' })).toEqual([]);
  });
});
