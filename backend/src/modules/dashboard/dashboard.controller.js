import * as service from './dashboard.service.js';
import { success } from '../../shared/http/response.js';

export const producer = async (req, res) => success(res, await service.producerDashboard(req));
