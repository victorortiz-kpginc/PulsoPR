using Microsoft.JSInterop;

namespace PulsoPR.Web.Models;

public sealed class AppwritePortalApi(IJSRuntime js, IConfiguration configuration) : IAsyncDisposable
{
    private IJSObjectReference? module;
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
            collections = section.GetSection("Collections").GetChildren()
                .ToDictionary(item => item.Key, item => item.Value ?? string.Empty)
        });
        return module;
    }

    public async Task<RemotePortalData> LoadDemoDataAsync() =>
        await (await ModuleAsync()).InvokeAsync<RemotePortalData>("loadDemoData");

    public async Task<RemotePortalData> LoadDemoDataAsync(AuthSession session) =>
        await (await ModuleAsync()).InvokeAsync<RemotePortalData>("loadDemoData", session);

    public async Task<AuthSession?> CurrentSessionAsync() =>
        await (await ModuleAsync()).InvokeAsync<AuthSession?>("currentSession");

    public async Task<AuthSession> SignInAsync(string email, string password) =>
        await (await ModuleAsync()).InvokeAsync<AuthSession>("signIn", email, password);

    public async Task SignOutAsync() =>
        await (await ModuleAsync()).InvokeVoidAsync("signOut");

    public async Task RequestRecoveryAsync(string email, string url) =>
        await (await ModuleAsync()).InvokeVoidAsync("requestRecovery", email, url);

    public async Task CompleteRecoveryAsync(string userId, string secret, string password) =>
        await (await ModuleAsync()).InvokeVoidAsync("finishRecovery", userId, secret, password);

    public async Task<ProviderView> CreateProviderAsync(ProviderView provider) =>
        await (await ModuleAsync()).InvokeAsync<ProviderView>("createProvider", provider);

    public async Task SaveProviderAsync(ProviderView provider, string section) =>
        await (await ModuleAsync()).InvokeVoidAsync("saveProvider", provider, section);

    public async Task RespondToRequestAsync(string id, string status, string note, string actorId) =>
        await (await ModuleAsync()).InvokeVoidAsync("respondToRequest", id, status, note, actorId);

    public async Task<GeographicMapData> LoadGeographicMapAsync(string municipalityId, int radiusKm, string providerType, double? latitude = null, double? longitude = null, string? role = null, string? teamId = null) =>
        await (await ModuleAsync()).InvokeAsync<GeographicMapData>("loadGeographicMap", new { municipalityId, radiusKm, providerType, latitude, longitude, role, teamId });

    public async ValueTask DisposeAsync()
    {
        if (module is not null)
        {
            try { await module.DisposeAsync(); }
            catch (JSDisconnectedException) { }
        }
    }
}
