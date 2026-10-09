namespace PulsoPR.Web.Models;

// View fixtures only. No Appwrite IDs, credentials or remote persistence.
public sealed class ProviderView
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string ProviderType { get; set; } = "organization";
    public string Municipality { get; set; } = "";
    public string Address { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Hours { get; set; } = "";
    public string State { get; set; } = "operational";
    public string Electricity { get; set; } = "available";
    public string Generator { get; set; } = "unknown";
    public string Note { get; set; } = "";
    public string ServiceAvailability { get; set; } = "available";
    public string ResourceAvailability { get; set; } = "limited";
    public string InterruptionStart { get; set; } = "";
    public string InterruptionEnd { get; set; } = "";
    public string ServiceNote { get; set; } = "Coordinar antes de acudir.";
    public string ResourceNote { get; set; } = "Consultar antes de acudir.";
    public string Source { get; set; } = "FacilityConfirmed";
    public DateTimeOffset? ConfirmedAt { get; set; }
    public ProviderView Copy() => (ProviderView)MemberwiseClone();
}
public sealed class RequestView
{
    public string Id { get; set; } = "";
    public string FacilityId { get; set; } = "";
    public string Description { get; set; } = "";
    public string Status { get; set; } = "submitted";
    public DateTimeOffset CreatedAt { get; set; }
    public List<(string State, DateTimeOffset Time, string Note)> Events { get; } = [];
}
public sealed class DemoStore
{
    public string SelectedId { get; set; } = "demo-farmacia";
    public string Role { get; set; } = "proveedor";
    public ProviderView Selected => Providers.Single(p => p.Id == SelectedId);
    public List<ProviderView> Providers { get; } =
    [
        new() { Id="demo-farmacia", Name="Farmacia Comunidad", Municipality="San Juan", Address="Calle Demo 24 · Dirección ficticia", Phone="Contacto de demostración", Hours="Lunes a viernes · 8:00 a. m. – 5:00 p. m.", State="operational", ConfirmedAt=DateTimeOffset.UtcNow.AddHours(-2), Note="Atendemos en horario regular. Coordina antes de visitar." },
        new() { Id="demo-centro", Name="Centro La Esperanza", ProviderType="community_center", Municipality="Ponce", Address="Plaza Demo · Dirección ficticia", Hours="Lunes a sábado · 9:00 a. m. – 3:00 p. m.", State="limited", Electricity="unavailable", Generator="available", ServiceAvailability="limited", ConfirmedAt=DateTimeOffset.UtcNow.AddHours(-27), Note="Servicios limitados por interrupción eléctrica." },
        new() { Id="demo-persona", Name="Elena · Apoyo comunitario", ProviderType="person", Municipality="Mayagüez", State="unknown", Electricity="unknown", Source="CommunityReported", ServiceAvailability="unknown", ConfirmedAt=DateTimeOffset.UtcNow.AddHours(-1), Note="Persona proveedora ficticia. Coordinar disponibilidad." },
        new() { Id="demo-organizacion", Name="Red de Apoyo del Sur", Municipality="Ponce", State="unavailable", Electricity="unknown", ServiceAvailability="unavailable", ResourceAvailability="unknown", Note="Sin confirmación reciente." }
    ];
    public List<RequestView> Requests { get; } =
    [
        new() { Id="DEMO-001", FacilityId="demo-farmacia", Description="Solicito orientación sobre el horario de farmacia para coordinar una visita.", CreatedAt=DateTimeOffset.UtcNow.AddMinutes(-35) },
        new() { Id="DEMO-002", FacilityId="demo-farmacia", Description="¿Hay disponibilidad de orientación farmacéutica esta tarde?", Status="acknowledged", CreatedAt=DateTimeOffset.UtcNow.AddHours(-2) },
        new() { Id="DEMO-003", FacilityId="demo-centro", Description="Solicito información sobre los servicios comunitarios disponibles.", Status="confirmed", CreatedAt=DateTimeOffset.UtcNow.AddHours(-4) },
        new() { Id="DEMO-004", FacilityId="demo-farmacia", Description="Consulta sintética de coordinación ya finalizada.", Status="completed", CreatedAt=DateTimeOffset.UtcNow.AddDays(-1) }
    ];
    public List<(string FacilityId, DateTimeOffset Time, string Title, string Note)> History { get; } =
    [
        ("demo-farmacia", DateTimeOffset.UtcNow.AddHours(-2), "Operación confirmada", "Farmacia Comunidad · Fuente: proveedor de demo"),
        ("demo-farmacia", DateTimeOffset.UtcNow.AddHours(-5), "Disponibilidad actualizada", "Orientación farmacéutica · Disponible"),
        ("demo-farmacia", DateTimeOffset.UtcNow.AddDays(-1), "Horario actualizado", "Lunes a viernes · 8:00 a. m. – 5:00 p. m.")
    ];
    public DemoStore()
    {
        foreach (var request in Requests.Where(r => r.Status != "submitted"))
        {
            request.Events.Add(("acknowledged", request.CreatedAt.AddMinutes(10), "Solicitud recibida en la fixture."));
            if (request.Status is "confirmed" or "completed")
                request.Events.Add(("confirmed", request.CreatedAt.AddMinutes(20), "Coordinación confirmada en la fixture."));
            if (request.Status == "completed")
                request.Events.Add(("completed", request.CreatedAt.AddMinutes(30), "Coordinación completada en la fixture."));
        }
    }
    public void Save(ProviderView edited)
    {
        var index = Providers.FindIndex(p => p.Id == edited.Id);
        Providers[index] = edited.Copy();
        History.Insert(0, (edited.Id, DateTimeOffset.UtcNow, "Información actualizada", $"{edited.Name} · Cambio simulado en memoria"));
    }
    public static string Label(string value) => value switch
    {
        "person"=>"Persona", "organization"=>"Organización", "community_center"=>"Centro comunitario",
        "operational"=>"Operativo", "limited"=>"Limitado", "unavailable"=>"No disponible", "unknown"=>"Sin información",
        "available"=>"Disponible", "submitted"=>"Enviada", "acknowledged"=>"Recibida", "confirmed"=>"Confirmada",
        "declined"=>"No se puede atender", "completed"=>"Completada", "cancelled"=>"Cancelada", _=>value
    };
    public static string LocalTime(DateTimeOffset date) => TimeZoneInfo.ConvertTime(date, TimeZoneInfo.FindSystemTimeZoneById("America/Puerto_Rico")).ToString("dd MMM · h:mm tt", System.Globalization.CultureInfo.GetCultureInfo("es-PR"));
    public static string Confirmation(ProviderView p) => p.ConfirmedAt is null ? "Sin confirmación" : p.ConfirmedAt > DateTimeOffset.UtcNow ? "Fecha inválida" : p.Source == "CommunityReported" ? "Reporte comunitario" : DateTimeOffset.UtcNow >= p.ConfirmedAt.Value.AddHours(24) ? "Confirmación vencida" : "Confirmación reciente";
}
