import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LOCAL_API_BASE } from '@/lib/config';
import { supabase } from '@/lib/supabase';

interface Insights {
  weather_summary?: string;
  packing: string[];
  dress: string;
  tips: string[];
}

interface WeatherData {
  temp_high: number;
  temp_low: number;
  precip_chance: number;
  condition: string;
}

export default function AiInsightsPanel({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (loaded || loading) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError('Not signed in'); setLoading(false); setLoaded(true); return; }

      const res = await fetch(`${LOCAL_API_BASE}/api/events/${eventId}/insights`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not load insights');
      } else {
        setWeather(data.weather ?? null);
        setInsights(data.insights ?? null);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  function toggle() {
    if (!open) load();
    setOpen((o) => !o);
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggle} style={styles.header} activeOpacity={0.7}>
        <View style={styles.headerLeft}>
          <Ionicons name="sparkles" size={14} color="#818CF8" />
          <Text style={styles.headerText}>AI Insights</Text>
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={14}
          color="#636366"
        />
      </TouchableOpacity>

      {open && (
        <View style={styles.body}>
          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#818CF8" />
              <Text style={styles.loadingText}>Fetching forecast & tips...</Text>
            </View>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          {!loading && loaded && insights && (
            <View style={styles.insightsContent}>
              {/* Weather */}
              {(weather || insights.weather_summary) && (
                <View style={styles.row}>
                  <Ionicons name="cloud-outline" size={14} color="#818CF8" style={styles.icon} />
                  <Text style={styles.rowText}>
                    {weather
                      ? `${weather.condition} \u00B7 ${weather.temp_low}\u2013${weather.temp_high}\u00B0F${weather.precip_chance > 0 ? ` \u00B7 ${weather.precip_chance}% rain` : ''}`
                      : insights.weather_summary}
                  </Text>
                </View>
              )}

              {/* Dress */}
              {insights.dress && (
                <View style={styles.row}>
                  <Ionicons name="shirt-outline" size={14} color="#818CF8" style={styles.icon} />
                  <Text style={styles.rowText}>{insights.dress}</Text>
                </View>
              )}

              {/* Packing */}
              {insights.packing?.length > 0 && (
                <View style={styles.row}>
                  <Ionicons name="bag-outline" size={14} color="#818CF8" style={styles.icon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Pack</Text>
                    {insights.packing.map((item, i) => (
                      <View key={i} style={styles.bulletRow}>
                        <View style={styles.bullet} />
                        <Text style={styles.rowText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Tips */}
              {insights.tips?.length > 0 && (
                <View style={styles.row}>
                  <Ionicons name="bulb-outline" size={14} color="#F59E0B" style={styles.icon} />
                  <View style={{ flex: 1 }}>
                    {insights.tips.map((tip, i) => (
                      <View key={i} style={styles.bulletRow}>
                        <View style={[styles.bullet, { backgroundColor: '#F59E0B' }]} />
                        <Text style={styles.rowText}>{tip}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {!loading && loaded && !insights && !error && (
            <Text style={styles.noData}>No insights available for this event.</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(99,102,241,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.2)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerText: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(99,102,241,0.2)',
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
  },
  loadingText: {
    color: '#818CF8',
    fontSize: 12,
  },
  errorText: {
    color: '#FF453A',
    fontSize: 12,
    paddingTop: 12,
  },
  insightsContent: {
    paddingTop: 12,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  icon: {
    marginTop: 2,
  },
  rowLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  rowText: {
    color: '#EBEBF5',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 2,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#818CF8',
    marginTop: 7,
  },
  noData: {
    color: '#636366',
    fontSize: 12,
    paddingTop: 12,
  },
});
