import type Innertube from "volumio-youtubei.js";
import { Endpoints } from "volumio-youtubei.js";

export async function getAccountInitialInfo(innertube: Innertube) {
  const response = await innertube.actions.execute(
    Endpoints.Account.AccountListEndpoint.PATH,
    Endpoints.Account.AccountListEndpoint.build()
  );

  let isSignedIn = false;
  if (!response.success) {
    throw Error(`Response error ${response.status_code}`)
  }

  if (response.data.responseContext?.serviceTrackingParams) {
    for (const params of response.data.responseContext.serviceTrackingParams) {
      const p = params.params?.find((p) => p.key === 'logged_in');
      if (p) {
        isSignedIn = p.value === '1' ? true : false;
        break;
      }
    }
  }

  return {
    isSignedIn,
    response
  };
}
