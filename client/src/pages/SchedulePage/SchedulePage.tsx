import { useState, useEffect, useMemo, useRef } from 'react';
import Sidebar from '../../components/common/Sidebar/Sidebar';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import api from '../../services/api';
import '../../pages/DashboardPage/DashboardPage.css';
import './SchedulePage.css';

interface Schedule {
  id: number; schedule_name: string; start_time: string;
  duration_minutes: number; repeat_days: string; is_active: boolean;
  device_id: number; user_id: number;
  start_date?: string; end_date?: string;
  creator_name?: string; device_type?: string; device_name?: string;
}

interface Device {
  id: number; device_name: string; device_type: string; status: string;
}

type ViewMode = 'day' | 'week';

const DAY_LABELS_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const DAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REPEAT_DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Màu cố định theo device_type
const DEVICE_COLORS: Record<string, string> = {
  pump1: '#3498DB',
  pump2: '#2BAE66',
  led_rgb: '#F5A623',
};

const DEVICE_ICONS: Record<string, string> = {
  pump1: 'water_drop',
  pump2: 'water_drop',
  led_rgb: 'lightbulb',
};
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const SchedulePage = () => {
  const { t, locale } = useLanguage();
  const { user, isAdmin } = useAuth();
  const dayLabels = locale === 'vi' ? DAY_LABELS_VI : DAY_LABELS_EN;

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Schedule | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number>(0);
  const [newSchedule, setNewSchedule] = useState({
    schedule_name: '', start_time: '08:00', duration_minutes: 30,
    repeat_days: 'Mon,Wed,Fri', device_id: 1, start_date: '', end_date: ''
  });
  const [showGrid, setShowGrid] = useState(true);
  const [now, setNow] = useState(new Date());
  const calContainerRef = useRef<HTMLDivElement>(null);
  const [deviceDropdownOpen, setDeviceDropdownOpen] = useState(false);
  const [facilityDropdownOpen, setFacilityDropdownOpen] = useState(false);
  const deviceDropdownRef = useRef<HTMLDivElement>(null);
  const facilityDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/schedules').then(({ data }) => setSchedules(data)).catch(() => {});
    api.get('/devices').then(({ data }) => {
      setDevices(data);
      if (data.length > 0 && selectedDeviceId === 0) setSelectedDeviceId(data[0].id);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update current time every 60s
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll to current time on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (calContainerRef.current) {
        const currentHour = new Date().getHours();
        const scrollTo = Math.max((currentHour - 1) * 60, 0);
        calContainerRef.current.scrollTop = scrollTo;
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Close custom dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (deviceDropdownRef.current && !deviceDropdownRef.current.contains(e.target as Node)) setDeviceDropdownOpen(false);
      if (facilityDropdownRef.current && !facilityDropdownRef.current.contains(e.target as Node)) setFacilityDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  // Navigation
  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - (viewMode === 'week' ? 7 : 1));
    setCurrentDate(d);
  };
  const goNext = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + (viewMode === 'week' ? 7 : 1));
    setCurrentDate(d);
  };

  // Get week range (Mon-Sun)
  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Mon=1
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  // Map schedule repeat_days key to JS getDay()
  const dayKeyToJS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  // Filter events for a given date
  // Format date thành YYYY-MM-DD theo local timezone (không dùng UTC)
  const toLocalDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const todayStr = toLocalDateStr(new Date());

  const getEventsForDate = (date: Date) => {
    const jsDay = date.getDay();
    const dateStr = toLocalDateStr(date);
    return schedules.filter(s => {
      // Filter theo thiết bị đang chọn
      if (selectedDeviceId && s.device_id !== selectedDeviceId) return false;
      // Filter by start_date/end_date range (normalize ISO dates)
      const sStart = s.start_date ? s.start_date.substring(0, 10) : '';
      const sEnd = s.end_date ? s.end_date.substring(0, 10) : '';
      if (sStart && dateStr < sStart) return false;
      if (sEnd && dateStr > sEnd) return false;
      if (s.repeat_days === 'daily') return true;
      const days = s.repeat_days.split(',').map(d => d.trim()).filter(Boolean);
      if (days.length === 0) return true;
      return days.some(dk => dayKeyToJS[dk] === jsDay);
    });
  };

  // Parse time string to hours (fractional)
  const timeToHours = (time: string) => {
    const [h, m] = (time || '00:00').substring(0, 5).split(':').map(Number);
    return h + m / 60;
  };

  const formatTimeLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

  const headerLabel = useMemo(() => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    }
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    const loc = locale === 'vi' ? 'vi-VN' : 'en-US';
    return `${weekStart.toLocaleDateString(loc, opts)} — ${end.toLocaleDateString(loc, { ...opts, year: 'numeric' })}`;
  }, [viewMode, currentDate, weekStart, locale]);

  // CRUD
  const handleCreate = async () => {
    // Validate: start_date không được trong quá khứ
    if (newSchedule.start_date && newSchedule.start_date < todayStr) {
      toast.error(t('schedule.pastDateError'));
      return;
    }
    // Validate: multi-day range requires repeat days
    const hasRepeatDays = newSchedule.repeat_days.split(',').filter(Boolean).length > 0;
    if (!hasRepeatDays && newSchedule.start_date && newSchedule.end_date && newSchedule.start_date !== newSchedule.end_date) {
      toast.error(t('schedule.multiDayRepeatError'));
      return;
    }
    try {
      const payload: Record<string, unknown> = {
        schedule_name: newSchedule.schedule_name,
        start_time: newSchedule.start_time,
        duration_minutes: newSchedule.duration_minutes,
        repeat_days: newSchedule.repeat_days,
        device_id: newSchedule.device_id,
      };
      if (newSchedule.start_date) payload.start_date = newSchedule.start_date;
      if (newSchedule.end_date) payload.end_date = newSchedule.end_date;
      const { data } = await api.post('/schedules', payload);
      setSchedules(prev => [...prev, data]);
      setShowModal(false);
      setNewSchedule({ schedule_name: '', start_time: '08:00', duration_minutes: 30, repeat_days: 'Mon,Wed,Fri', device_id: 1, start_date: '', end_date: '' });
      toast.success(t('schedule.scheduleCreated'));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Lỗi tạo lịch';
      toast.error(msg);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/schedules/${id}`);
      setSchedules(prev => prev.filter(s => s.id !== id));
      if (selectedEvent?.id === id) setSelectedEvent(null);
      toast.success(t('schedule.scheduleDeleted'));
    } catch { toast.error('Error'); }
  };

  const canModify = (s: Schedule) => isAdmin || s.user_id === user?.id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Render a single column of events
  const renderDayColumn = (date: Date, events: Schedule[]) => {
    const isToday = date.toDateString() === today.toDateString();
    const gridClass = showGrid ? '' : 'no-grid';
    return (
      <div className={`cal-day-col ${isToday ? 'today' : ''} ${gridClass}`} key={date.toISOString()}>
        {isToday && (
          <div className="cal-now-line" style={{ top: `${(now.getHours() + now.getMinutes() / 60) * 60}px` }} />
        )}
        {events.map((ev, idx) => {
          const top = timeToHours(ev.start_time);
          const height = ev.duration_minutes / 60;
          const color = DEVICE_COLORS[ev.device_type || ''] || '#3498DB';
          return (
            <div key={ev.id} className="cal-event" style={{
              top: `${top * 60}px`,
              height: `${Math.max(height * 60, 28)}px`,
              background: color,
              zIndex: idx + 1
            }} onClick={() => setSelectedEvent(ev)}
              title={`${ev.schedule_name}\n${t(`devices.${ev.device_type}`)} — ${ev.creator_name || ''}`}>
              <span className="cal-event-title">{ev.schedule_name}</span>
              <span className="cal-event-time">
                {ev.start_time?.substring(0, 5)} — {(() => {
                  const [h, m] = (ev.start_time || '00:00').substring(0, 5).split(':').map(Number);
                  const total = h * 60 + m + ev.duration_minutes;
                  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
                })()}
              </span>
              <span className="cal-event-meta">{t(`devices.${ev.device_type}`)} · {ev.creator_name || '?'}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Toggle repeat day for new schedule
  const toggleNewDay = (dayKey: string) => {
    const days = newSchedule.repeat_days.split(',').filter(Boolean);
    const newDays = days.includes(dayKey) ? days.filter(d => d !== dayKey) : [...days, dayKey];
    setNewSchedule({ ...newSchedule, repeat_days: newDays.join(',') });
  };

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1 className="page-title">{t('schedule.title')}</h1>
            <p className="page-subtitle">{t('schedule.subtitle')}</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>{t('schedule.newEvent')}</button>
        </header>

        {/* Calendar Toolbar */}
        <div className="cal-toolbar">
          <div className="cal-nav">
            <button className="btn btn-secondary cal-today-btn" onClick={goToday}>
              {t('schedule.today')}
            </button>
            <button className="cal-arrow" onClick={goPrev}>
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button className="cal-arrow" onClick={goNext}>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <span className="cal-header-label">{headerLabel}</span>
          </div>
          <div className="cal-right-controls">
            <div className="device-selector" ref={deviceDropdownRef}>
              <button
                className="device-select-btn"
                onClick={() => setDeviceDropdownOpen(o => !o)}
              >
                <span className="device-sel-dot" style={{ background: DEVICE_COLORS[selectedDevice?.device_type || ''] || 'var(--primary)' }} />
                <span className="material-symbols-outlined device-sel-icon">
                  {DEVICE_ICONS[selectedDevice?.device_type || ''] || 'devices'}
                </span>
                <span className="device-sel-label">{selectedDevice ? t(`devices.${selectedDevice.device_type}`) : '—'}</span>
                <span className={`material-symbols-outlined device-sel-arrow ${deviceDropdownOpen ? 'open' : ''}`}>expand_more</span>
              </button>
              {deviceDropdownOpen && (
                <div className="custom-dropdown">
                  {devices.map(d => (
                    <div
                      key={d.id}
                      className={`custom-dropdown-item ${d.id === selectedDeviceId ? 'active' : ''}`}
                      onClick={() => { setSelectedDeviceId(d.id); setDeviceDropdownOpen(false); }}
                    >
                      <span className="dropdown-item-dot" style={{ background: DEVICE_COLORS[d.device_type] || 'var(--primary)' }} />
                      <span className="material-symbols-outlined dropdown-item-icon">
                        {DEVICE_ICONS[d.device_type] || 'devices'}
                      </span>
                      <span>{t(`devices.${d.device_type}`)}</span>
                      {d.id === selectedDeviceId && <span className="material-symbols-outlined dropdown-item-check">check</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="cal-view-toggle">
              <button
                className="cal-arrow"
                onClick={() => setShowGrid(g => !g)}
                title={showGrid ? t('schedule.hideGrid') : t('schedule.showGrid')}
              >
                <span className="material-symbols-outlined">{showGrid ? 'grid_on' : 'grid_off'}</span>
              </button>
              <button className={`cal-view-btn ${viewMode === 'day' ? 'active' : ''}`}
                onClick={() => setViewMode('day')}>
                {t('schedule.day')}
              </button>
              <button className={`cal-view-btn ${viewMode === 'week' ? 'active' : ''}`}
                onClick={() => setViewMode('week')}>
                {t('schedule.week')}
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="cal-outer card">
          {/* Day headers — outside the scroll container so they never scroll */}
          {viewMode === 'week' && (
            <div className="cal-day-headers">
              <div className="cal-time-gutter-header"></div>
              {weekDays.map((d, i) => {
                const isToday = d.toDateString() === today.toDateString();
                // i: 0=Mon → dayLabels index: Mon=1
                const labelIdx = d.getDay(); // 0=Sun..6=Sat
                return (
                  <div key={i} className={`cal-day-header ${isToday ? 'today' : ''}`}>
                    <span className="cal-day-name">{dayLabels[labelIdx]}</span>
                    <span className={`cal-day-num ${isToday ? 'today-num' : ''}`}>{d.getDate()}</span>
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === 'day' && (
            <div className="cal-day-headers">
              <div className="cal-time-gutter-header"></div>
              <div className={`cal-day-header today`}>
                <span className="cal-day-name">{dayLabels[currentDate.getDay()]}</span>
                <span className="cal-day-num today-num">{currentDate.getDate()}</span>
              </div>
            </div>
          )}

          {/* Scrollable body — only this part scrolls */}
          <div className="cal-scroll" ref={calContainerRef}>
            <div className="cal-body">
              {/* Time gutter */}
              <div className="cal-time-gutter">
                {HOURS.map(h => (
                  <div key={h} className="cal-time-slot">
                    <span>{formatTimeLabel(h)}</span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              <div className={`cal-columns ${viewMode}`}>
                {viewMode === 'week'
                  ? weekDays.map(d => renderDayColumn(d, getEventsForDate(d)))
                  : renderDayColumn(currentDate, getEventsForDate(currentDate))
                }
              </div>
            </div>
          </div>
        </div>

        {/* Event detail popup */}
        {selectedEvent && (
          <div className="cal-event-popup card">
            <div className="cal-popup-header">
              <h3>{selectedEvent.schedule_name}</h3>
              <button className="cal-popup-close" onClick={() => setSelectedEvent(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="cal-popup-body">
              <p><span className="material-symbols-outlined" style={{fontSize:'1rem'}}>device_hub</span> {t(`devices.${selectedEvent.device_type}`)}</p>
              <p><span className="material-symbols-outlined" style={{fontSize:'1rem'}}>person</span> {selectedEvent.creator_name || '?'}</p>
              <p><span className="material-symbols-outlined" style={{fontSize:'1rem'}}>schedule</span> {selectedEvent.start_time?.substring(0,5)} — {selectedEvent.duration_minutes} {t('schedule.minutes')}</p>
              <p><span className="material-symbols-outlined" style={{fontSize:'1rem'}}>repeat</span> {selectedEvent.repeat_days}</p>
              {selectedEvent.start_date && <p><span className="material-symbols-outlined" style={{fontSize:'1rem'}}>calendar_today</span> {selectedEvent.start_date} → {selectedEvent.end_date || '∞'}</p>}
            </div>
            {canModify(selectedEvent) && (
              <div className="cal-popup-actions">
                <button className="btn btn-danger-outline" onClick={() => { handleDelete(selectedEvent.id); setSelectedEvent(null); }}>
                  <span className="material-symbols-outlined" style={{fontSize:'1rem'}}>delete</span>
                  {t('schedule.delete')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Modal tạo mới */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3>{t('schedule.createNew')}</h3>
              <div className="form-group">
                <label>{t('schedule.eventName')}</label>
                <input type="text" className="input-text" value={newSchedule.schedule_name}
                  onChange={e => setNewSchedule({ ...newSchedule, schedule_name: e.target.value })}
                  placeholder={t('schedule.placeholder')} />
              </div>
              <div className="form-group" ref={facilityDropdownRef}>
                <label>{t('schedule.facility')}</label>
                <div className="custom-select-wrapper">
                  <button
                    type="button"
                    className="custom-select-trigger"
                    onClick={() => setFacilityDropdownOpen(o => !o)}
                  >
                    <span className="dropdown-item-dot" style={{ background: DEVICE_COLORS[devices.find(d => d.id === newSchedule.device_id)?.device_type || ''] || 'var(--primary)' }} />
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>
                      {DEVICE_ICONS[devices.find(d => d.id === newSchedule.device_id)?.device_type || ''] || 'devices'}
                    </span>
                    <span className="custom-select-value">{t(`devices.${devices.find(d => d.id === newSchedule.device_id)?.device_type}`)}</span>
                    <span className={`material-symbols-outlined custom-select-arrow ${facilityDropdownOpen ? 'open' : ''}`}>expand_more</span>
                  </button>
                  {facilityDropdownOpen && (
                    <div className="custom-dropdown in-modal">
                      {devices.map(d => (
                        <div
                          key={d.id}
                          className={`custom-dropdown-item ${d.id === newSchedule.device_id ? 'active' : ''}`}
                          onClick={() => { setNewSchedule({ ...newSchedule, device_id: d.id }); setFacilityDropdownOpen(false); }}
                        >
                          <span className="dropdown-item-dot" style={{ background: DEVICE_COLORS[d.device_type] || 'var(--primary)' }} />
                          <span className="material-symbols-outlined dropdown-item-icon">
                            {DEVICE_ICONS[d.device_type] || 'devices'}
                          </span>
                          <span>{t(`devices.${d.device_type}`)}</span>
                          {d.id === newSchedule.device_id && <span className="material-symbols-outlined dropdown-item-check">check</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('schedule.startTime')}</label>
                  <div className="input-icon-wrapper">
                    <span className="material-symbols-outlined input-icon">schedule</span>
                    <input type="time" className="input-text has-icon" value={newSchedule.start_time}
                      onChange={e => setNewSchedule({ ...newSchedule, start_time: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('schedule.duration')}</label>
                  <div className="input-icon-wrapper">
                    <span className="material-symbols-outlined input-icon">timelapse</span>
                    <input type="number" className="input-text has-icon" value={newSchedule.duration_minutes}
                      min={5} step={5}
                      onChange={e => setNewSchedule({ ...newSchedule, duration_minutes: Number(e.target.value) })} />
                    <span className="input-suffix">{t('schedule.minutes')}</span>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>{t('schedule.repeatDays')}</label>
                <div className="day-pills">
                  {REPEAT_DAY_KEYS.map((dk, i) => {
                    const days = newSchedule.repeat_days.split(',');
                    const isActive = days.includes(dk);
                    const label = locale === 'vi' ? DAY_LABELS_VI[[1,2,3,4,5,6,0][i]] : DAY_LABELS_EN[[1,2,3,4,5,6,0][i]];
                    return (
                      <span key={dk} className={`day-pill ${isActive ? 'active' : ''}`}
                        onClick={() => toggleNewDay(dk)}>{label}</span>
                    );
                  })}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('schedule.startDate')}</label>
                  <div className="input-icon-wrapper">
                    <span className="material-symbols-outlined input-icon">calendar_today</span>
                    <input type="date" className="input-text has-icon" value={newSchedule.start_date}
                      min={todayStr}
                      onChange={e => setNewSchedule({ ...newSchedule, start_date: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('schedule.endDate')}</label>
                  <div className="input-icon-wrapper">
                    <span className="material-symbols-outlined input-icon">event</span>
                    <input type="date" className="input-text has-icon" value={newSchedule.end_date}
                      min={newSchedule.start_date || undefined}
                      onChange={e => setNewSchedule({ ...newSchedule, end_date: e.target.value })} />
                  </div>
                </div>
              </div>
              {newSchedule.start_date && newSchedule.end_date && newSchedule.end_date < newSchedule.start_date && (
                <p className="form-error">{t('schedule.dateError')}</p>
              )}
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={handleCreate}
                  disabled={!newSchedule.schedule_name || (!!newSchedule.start_date && !!newSchedule.end_date && newSchedule.end_date < newSchedule.start_date)}>{t('schedule.create')}</button>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('schedule.cancel')}</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SchedulePage;
