using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using MudBlazor.Services;
using PulsoPR.Web;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");
builder.Services.AddMudServices();
builder.Services.AddScoped<PulsoPR.Web.Models.DemoStore>();
builder.Services.AddScoped<PulsoPR.Web.Models.AppwritePortalApi>();
builder.Services.AddScoped<PulsoPR.Web.Models.PortalAuthState>();
await builder.Build().RunAsync();
