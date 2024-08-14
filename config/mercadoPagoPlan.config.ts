import MercadoPagoConfig from 'mercadopago';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig({ path: '.env' });

export const planClient = new MercadoPagoConfig({
  accessToken:
    'APP_USR-6795275057660122-073011-154dfa6cc6845f14ff72ae59d7723aa8-1289604664',
});
