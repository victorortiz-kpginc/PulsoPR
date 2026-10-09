namespace PulsoPR.Web.Models;

public sealed class GeographicMapData
{
    public List<GeographicPlace> Places { get; set; } = [];
    public List<GeographicMunicipality> Municipalities { get; set; } = [];
}

public sealed class GeographicPlace
{
    public string Id { get; set; } = "";
    public string Kind { get; set; } = "provider";
    public string Name { get; set; } = "";
    public string Type { get; set; } = "";
    public string Municipality { get; set; } = "";
    public string MunicipalityId { get; set; } = "";
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double? RadiusMeters { get; set; }
    public string Detail { get; set; } = "";
    public double? DistanceKm { get; set; }
}

public sealed class GeographicMunicipality
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
}
