export declare enum EndpointType {
    Browse = "browse",
    Watch = "watch",
    Search = "search",
    BrowseContinuation = "browseContinuation",
    SearchContinuation = "searchContinuation"
}
interface Endpoint {
    type: EndpointType;
    payload: Record<string, any>;
}
export default Endpoint;
//# sourceMappingURL=Endpoint.d.ts.map