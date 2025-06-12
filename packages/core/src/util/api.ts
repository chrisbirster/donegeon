import { Resource } from 'sst';

export const getSecret = async () => Resource.TurnstileSecret.value;

