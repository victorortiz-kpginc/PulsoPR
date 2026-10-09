using Microsoft.JSInterop;

namespace PulsoPR.Web.Models;

public sealed class AppwritePortalApi(IJSRuntime js, IConfiguration configuration) : IAsyncDisposable
{
    private IJSObjectReference? module;
    private static readonly IReadOnlyDictionary<string, string> Collections = new Dictionary<string, string>
    {
        ["facilities"] = "facilities",
        ["facilityServices"] = "facility_services",
        ["facilityOperationalStatus"] = "facility_operational_status",
        ["resourceAvailability"] = "resource_availability",
        ["facilityConfirmations"] = "facility_confirmations",
        ["facilityStatusHistory"] = "facility_status_history",
        ["assistanceRequests"] = "assistance_requests",
        ["assistanceRequestEvents"] = "assistance_request_events"
    };

    private async Task<IJSObjectReference> ModuleAsync()
    {
        if (module is not null) return module;
        module = await js.InvokeAsync<IJSObjectReference>("import", "./js/appwrite-api.js");
        var section = configuration.GetSection("Appwrite");
        await module.InvokeVoidAsync("initialize", new
        {
            endpoint = section["Endpoint"],
            projectId = section["ProjectId"],
            databaseId = section["DatabaseId"],
            collections = Collections
        });
        return module;
    }

    public async Task<RemotePortalData> LoadDemoDataAsync() =>
        await (await ModuleAsync()).InvokeAsync<RemotePortalData>("loadDemoData");

    public async Task SaveProviderAsync(ProviderView provider, string section) =>
        await (await ModuleAsync()).InvokeVoidAsync("saveProvider", provider, section);

    public async Task RespondToRequestAsync(string id, string status, string note) =>
        await (await ModuleAsync()).InvokeVoidAsync("respondToRequest", id, status, note);

    public async ValueTask DisposeAsync()
    {
        if (module is not null)
        {
            try { await module.DisposeAsync(); }
            catch (JSDisconnectedException) { }
        }
    }
}
