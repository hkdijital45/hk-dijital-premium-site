using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace HKDijital;

public partial class MainWindow : Window
{
    private readonly DesktopConfig _config;

    public MainWindow()
    {
        InitializeComponent();
        _config = DesktopConfig.Load();
        Title = _config.AppName;
        Loaded += MainWindow_Loaded;
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            await Browser.EnsureCoreWebView2Async();
            Browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
            Browser.CoreWebView2.Settings.IsStatusBarEnabled = true;
            Browser.NavigationStarting += Browser_NavigationStarting;
            Browser.NavigationCompleted += Browser_NavigationCompleted;
            Browser.Source = new Uri(_config.ProductionUrl);
        }
        catch
        {
            ShowError("WebView2 Runtime bulunamadı veya internet bağlantısı kurulamadı.");
        }
    }

    private void Browser_NavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        LoadingPanel.Visibility = Visibility.Visible;
        ErrorPanel.Visibility = Visibility.Collapsed;

        if (!IsAllowed(e.Uri))
        {
            e.Cancel = true;
            OpenExternal(e.Uri);
            LoadingPanel.Visibility = Visibility.Collapsed;
        }
    }

    private void Browser_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        LoadingPanel.Visibility = Visibility.Collapsed;
        BackButton.IsEnabled = Browser.CanGoBack;
        ForwardButton.IsEnabled = Browser.CanGoForward;

        if (!e.IsSuccess)
        {
            ShowError("İnternet bağlantınızı veya HK Dijital adresini kontrol edin.");
        }
    }

    private bool IsAllowed(string rawUrl)
    {
        if (!Uri.TryCreate(rawUrl, UriKind.Absolute, out var uri)) return false;
        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return false;
        return _config.AllowedHosts.Any(host => string.Equals(host, uri.Host, StringComparison.OrdinalIgnoreCase));
    }

    private void OpenExternal(string rawUrl)
    {
        Process.Start(new ProcessStartInfo(rawUrl) { UseShellExecute = true });
    }

    private void ShowError(string message)
    {
        ErrorText.Text = message;
        ErrorPanel.Visibility = Visibility.Visible;
        LoadingPanel.Visibility = Visibility.Collapsed;
    }

    private void Back_Click(object sender, RoutedEventArgs e)
    {
        if (Browser.CanGoBack) Browser.GoBack();
    }

    private void Forward_Click(object sender, RoutedEventArgs e)
    {
        if (Browser.CanGoForward) Browser.GoForward();
    }

    private void Refresh_Click(object sender, RoutedEventArgs e)
    {
        ErrorPanel.Visibility = Visibility.Collapsed;
        Browser.Reload();
    }

    private void Retry_Click(object sender, RoutedEventArgs e)
    {
        ErrorPanel.Visibility = Visibility.Collapsed;
        Browser.Source = new Uri(_config.ProductionUrl);
    }

    private void Support_Click(object sender, RoutedEventArgs e)
    {
        OpenExternal(_config.SupportUrl);
    }
}

public sealed class DesktopConfig
{
    public string AppName { get; set; } = "HK Dijital";
    public string ProductionUrl { get; set; } = "https://hkdijital.com.tr/digital-center";
    public string SupportUrl { get; set; } = "https://hkdijital.com.tr/iletisim";
    public string Version { get; set; } = "0.1.0";
    public string? UpdateCheckUrl { get; set; }
    public string[] AllowedHosts { get; set; } = [];

    public static DesktopConfig Load()
    {
        var envUrl = Environment.GetEnvironmentVariable("HK_DESKTOP_APP_URL");
        if (!string.IsNullOrWhiteSpace(envUrl))
        {
            return new DesktopConfig
            {
                ProductionUrl = envUrl,
                SupportUrl = envUrl,
                AllowedHosts = Uri.TryCreate(envUrl, UriKind.Absolute, out var uri) && uri.Host.Length > 0 ? [uri.Host] : []
            };
        }

        var path = Path.Combine(AppContext.BaseDirectory, "desktop-config.json");
        if (!File.Exists(path)) return new DesktopConfig { AllowedHosts = ["hkdijital.com.tr", "www.hkdijital.com.tr"] };
        var json = File.ReadAllText(path);
        return JsonSerializer.Deserialize<DesktopConfig>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new DesktopConfig();
    }
}
