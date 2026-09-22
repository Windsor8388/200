import React, { useState, useEffect } from 'react';
import { Mail, Send, AlertTriangle, CheckCircle, ShieldCheck, Clock, RefreshCw } from 'lucide-react';
import { sendGmailMessage, listRecentTradingAlerts } from '../lib/gmailService.ts';
import type { AiAnalysisResult } from './ChartAnalyzer.tsx';

interface GmailAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: AiAnalysisResult | null;
  pair: string;
  userEmail: string;
  accessToken: string | null;
  onRequireLogin: () => void;
}

export const GmailAlertModal: React.FC<GmailAlertModalProps> = ({
  isOpen,
  onClose,
  analysis,
  pair,
  userEmail,
  accessToken,
  onRequireLogin,
}) => {
  const [recipient, setRecipient] = useState(userEmail || 'alshmysyw973@gmail.com');
  const [subject, setSubject] = useState(`[تنبيه تداول BingX] إشارة جديدة لزوج ${pair}`);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [recentEmails, setRecentEmails] = useState<Array<{ id: string; snippet: string }>>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);

  useEffect(() => {
    if (userEmail) setRecipient(userEmail);
    if (pair) setSubject(`[تنبيه تداول BingX] إشارة جديدة لزوج ${pair}`);
  }, [userEmail, pair]);

  useEffect(() => {
    if (isOpen && accessToken) {
      loadRecentAlerts();
    }
  }, [isOpen, accessToken]);

  const loadRecentAlerts = async () => {
    if (!accessToken) return;
    setIsLoadingEmails(true);
    try {
      const messages = await listRecentTradingAlerts(accessToken);
      setRecentEmails(messages);
    } catch (e) {
      console.warn('Could not list alerts:', e);
    } finally {
      setIsLoadingEmails(false);
    }
  };

  const constructEmailHtml = () => {
    return `
      <div dir="rtl" style="font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px;">
        <h2 style="color: #38bdf8; margin-top: 0;">🚀 تقرير إشارة تداول آلية - BingX AI Trading</h2>
        <p><strong>الزوج:</strong> ${pair}</p>
        <p><strong>التوصية:</strong> <span style="color: ${analysis?.recommendation === 'BUY' ? '#10b981' : '#f43f5e'}; font-weight: bold;">${analysis?.recommendation || 'LONG'}</span></p>
        <p><strong>نسبة احتمالية الفوز (Win Rate):</strong> ${analysis?.winRateEstimate || 80}%</p>
        <p><strong>سعر الدخول المقترح:</strong> $${analysis?.entryTarget || 'N/A'}</p>
        <p><strong>وقف الخسارة (SL):</strong> $${analysis?.stopLoss || 'N/A'}</p>
        <p><strong>جني الأرباح (TP):</strong> $${analysis?.takeProfit1 || 'N/A'}</p>
        <hr style="border-color: #334155;" />
        <h3>تحليل المؤشرات والذكاء الاصطناعي:</h3>
        <p>${analysis?.indicatorsAnalysis || 'تحليل فني مكتمل'}</p>
        <p><em>${analysis?.reasoningArabic || ''}</em></p>
        <small style="color: #94a3b8;">تم إنشاء وتأكيد هذا الإشعار عبر منصة وكلاء BingX الذكية.</small>
      </div>
    `;
  };

  const handleSendClicked = () => {
    if (!accessToken) {
      onRequireLogin();
      return;
    }
    // Google Workspace skill mandatory confirmation check
    setShowConfirmDialog(true);
  };

  const handleConfirmedSend = async () => {
    setShowConfirmDialog(false);
    if (!accessToken) return;

    setIsSending(true);
    setStatusMessage(null);
    try {
      const result = await sendGmailMessage(accessToken, {
        to: recipient,
        subject,
        bodyHtml: constructEmailHtml(),
      });

      if (result.success) {
        setStatusMessage({
          type: 'success',
          text: `تم إرسال إشعار التداول بنجاح إلى ${recipient} عبر حسابك في Gmail.`,
        });
        loadRecentAlerts();
      } else {
        throw new Error(result.error || 'فشل الإرسال عبر Gmail');
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'حدث خطأ أثناء الاتصال بخدمة Gmail',
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div id="gmail-alerts-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-lg shadow-2xl flex flex-col gap-4 text-right max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-base">
              إرسال تنبيهات الصفقات عبر Gmail
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 text-lg">
            ✕
          </button>
        </div>

        {!accessToken ? (
          <div className="bg-indigo-950/40 border border-indigo-800 rounded-xl p-4 flex flex-col gap-3 text-xs text-indigo-200">
            <div className="flex items-center gap-2 font-bold text-sm text-indigo-300">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              <span>يتطلب تسجيل الدخول بحساب Google Workspace</span>
            </div>
            <p>
              لتتمكن المنصة من إرسال واستقبال تنبيهات الصفقات إلى بريدك الإلكتروني بإذنك، يرجى ربط حساب Google الخاص بك.
            </p>
            <button
              id="btn-login-for-gmail"
              onClick={onRequireLogin}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg cursor-pointer transition-colors self-start"
            >
              تسجيل الدخول وتفعيل Gmail الآن
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">البريد الإلكتروني المستلم</label>
              <input
                id="gmail-recipient-input"
                type="email"
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">عنوان الرسالة</label>
              <input
                id="gmail-subject-input"
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-300">
              <span className="font-bold text-cyan-400 block mb-1">محتوى الإشعار الجاهز:</span>
              <p>• الزوج: {pair}</p>
              <p>• التوصية: {analysis?.recommendation || 'شراء (LONG)'}</p>
              <p>• الهدف: ${analysis?.takeProfit1 || 'أهداف متقدمة'}</p>
              <p>• وقف الخسارة: ${analysis?.stopLoss || 'حماية الهامش'}</p>
            </div>

            {statusMessage && (
              <div
                className={`p-3 rounded-lg border flex items-center gap-2 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300'
                    : 'bg-rose-950/70 border-rose-700 text-rose-300'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <button
              id="btn-prepare-send-email"
              disabled={isSending}
              onClick={handleSendClicked}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
            >
              {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>إرسال تقرير الصفقة الآن</span>
            </button>
          </div>
        )}

        {/* Mandatory Confirmation Modal according to Workspace Skill */}
        {showConfirmDialog && (
          <div id="gmail-confirmation-dialog" className="fixed inset-0 bg-slate-950/90 z-60 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-amber-600/60 rounded-xl p-5 max-w-sm w-full text-right flex flex-col gap-3 shadow-2xl">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>تأكيد إرسال البريد الإلكتروني</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                هل تؤكد رغبتك في إرسال تقرير صفقة {pair} إلى البريد التالي؟
                <br />
                <strong className="text-white block mt-1 font-mono">{recipient}</strong>
              </p>
              <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  id="btn-confirm-gmail-send"
                  onClick={handleConfirmedSend}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer"
                >
                  نعم، أرسل الآن
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
