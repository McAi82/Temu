// web/src/pages/PublicTicket.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Car,
  User,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  Printer,
  Share2,
  Shield,
  QrCode,
  Phone,
  Mail,
  Building,
  Ticket,
} from "lucide-react";
import temuLogo from "../assets/temu-logo.png";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const PublicTicket = () => {
  const { ticketNumber } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTicket();
  }, [ticketNumber]);

  const fetchTicket = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/public-ticket/${ticketNumber}`,
      );
      setTicket(response.data);
    } catch (err) {
      console.error("Error fetching ticket:", err);
      setError("Ticket not found or has been removed.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIXED: Calculate total fine correctly
  const getTotalFine = () => {
    if (!ticket) return 0;

    // Check if ticket has violations array
    if (
      ticket.violations &&
      Array.isArray(ticket.violations) &&
      ticket.violations.length > 0
    ) {
      return ticket.violations.reduce((sum, v) => {
        const fine = parseFloat(v?.fine_amount) || 0;
        return sum + fine;
      }, 0);
    }

    // Check if ticket has total_fine property
    if (ticket.total_fine) {
      return parseFloat(ticket.total_fine) || 0;
    }

    return 0;
  };

  // ✅ FIXED: Get violation name safely
  const getViolationName = (violation) => {
    if (!violation) return "Unknown Violation";
    if (violation.violation_type) {
      return violation.violation_type.violation_name || "Unknown Violation";
    }
    if (violation.violation_name) {
      return violation.violation_name;
    }
    return "Unknown Violation";
  };

  // ✅ FIXED: Get fine amount safely
  const getFineAmount = (violation) => {
    if (!violation) return 0;
    if (violation.fine_amount) return parseFloat(violation.fine_amount) || 0;
    if (violation.fine) return parseFloat(violation.fine) || 0;
    return 0;
  };

  const getStatusBadge = (status) => {
    const styles = {
      paid: "bg-[#E5F2EA] text-[#1E8449] border-[#1E8449]/20",
      issued: "bg-[#FBF1DC] text-[#92600A] border-[#F0B429]/20",
      contested: "bg-[#FBEAE2] text-[#C2541F] border-[#C2541F]/20",
      dismissed: "bg-[#FBE7E9] text-[#C8202F] border-[#C8202F]/20",
      partial_paid: "bg-[#EEF1F5] text-[#3B5170] border-[#3B5170]/20",
    };
    return styles[status] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="w-5 h-5 text-[#1E8449]" />;
      case "issued":
        return <Clock className="w-5 h-5 text-[#92600A]" />;
      case "contested":
        return <AlertCircle className="w-5 h-5 text-[#C2541F]" />;
      case "dismissed":
        return <XCircle className="w-5 h-5 text-[#C8202F]" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      paid: "PAID",
      issued: "ISSUED",
      contested: "CONTESTED",
      dismissed: "DISMISSED",
      partial_paid: "PARTIAL PAID",
    };
    return labels[status] || status?.toUpperCase() || "UNKNOWN";
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `Ticket ${ticket?.ticket_number}`,
          text: `Traffic Violation Ticket ${ticket?.ticket_number}`,
          url: window.location.href,
        })
        .catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#16233F] mx-auto"></div>
          <p className="text-[#64748B] mt-4 font-['Inter']">
            Loading ticket...
          </p>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] p-4">
        <Card className="max-w-md w-full text-center border-[#C8202F]/20">
          <CardContent className="p-8">
            <div className="w-20 h-20 rounded-full bg-[#FBE7E9] flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-[#C8202F]" />
            </div>
            <h2 className="text-xl font-['Oswald'] font-semibold text-[#1F2937] mb-2">
              Ticket Not Found
            </h2>
            <p className="text-[#64748B] font-['Inter']">
              {error ||
                "The ticket you're looking for doesn't exist or has been removed."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalFine = getTotalFine();

  return (
    <div className="min-h-screen bg-[#F5F6F8] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-white rounded-xl shadow-sm p-4 border border-[#E9ECF2]">
          <div className="flex items-center gap-3">
            <img
              src={temuLogo}
              alt="TEMU Logo"
              className="w-12 h-12 rounded-lg"
            />
            <div>
              <h1 className="text-xl font-['Oswald'] font-semibold text-[#16233F]">
                TEMU
              </h1>
              <p className="text-xs text-[#64748B] font-['Inter']">
                Traffic Enforcement and Management Unit
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2] hidden print:hidden"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2] hidden print:hidden"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </div>

        {/* Ticket Card */}
        <Card className="overflow-hidden shadow-lg border border-[#E9ECF2] print:shadow-none print:border-none">
          {/* Ticket Header */}
          <div className="bg-[#16233F] px-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[#F0B429] text-xs font-['Inter'] uppercase tracking-wider">
                  Official Traffic Violation Ticket
                </p>
                <h2 className="text-2xl font-['Oswald'] font-semibold text-white mt-1">
                  {ticket.ticket_number}
                </h2>
              </div>
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-full border ${getStatusBadge(ticket.status)} bg-white/95`}
              >
                {getStatusIcon(ticket.status)}
                <span className="text-sm font-semibold">
                  {getStatusLabel(ticket.status)}
                </span>
              </div>
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Violator Information */}
            <div className="bg-[#F8F9FA] rounded-xl p-5 border border-[#E9ECF2]">
              <h3 className="text-sm font-['Oswald'] font-medium text-[#16233F] flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-[#F0B429]" />
                Violator Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-[#64748B] font-['Inter']">
                    Full Name
                  </p>
                  <p className="text-[#1F2937] font-['Inter'] font-medium">
                    {ticket.violator?.firstname}{" "}
                    {ticket.violator?.middlename || ""}{" "}
                    {ticket.violator?.lastname}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] font-['Inter']">
                    License Number
                  </p>
                  <p className="text-[#1F2937] font-['Inter'] font-mono">
                    {ticket.violator?.license || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] font-['Inter']">
                    License Expiry
                  </p>
                  <p className="text-[#1F2937] font-['Inter']">
                    {ticket.violator?.expiry
                      ? new Date(ticket.violator.expiry).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] font-['Inter']">
                    Contact
                  </p>
                  <p className="text-[#1F2937] font-['Inter']">
                    {ticket.violator?.contact_number || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Vehicle Information */}
            <div className="bg-[#F8F9FA] rounded-xl p-5 border border-[#E9ECF2]">
              <h3 className="text-sm font-['Oswald'] font-medium text-[#16233F] flex items-center gap-2 mb-3">
                <Car className="w-4 h-4 text-[#F0B429]" />
                Vehicle Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-[#64748B] font-['Inter']">
                    Plate Number
                  </p>
                  <p className="text-[#1F2937] font-['Inter'] font-mono font-bold">
                    {ticket.vehicle?.platenumber || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] font-['Inter']">Owner</p>
                  <p className="text-[#1F2937] font-['Inter']">
                    {ticket.vehicle?.owner || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] font-['Inter']">
                    Make & Model
                  </p>
                  <p className="text-[#1F2937] font-['Inter']">
                    {ticket.vehicle?.make || ""} {ticket.vehicle?.model || ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] font-['Inter']">Color</p>
                  <p className="text-[#1F2937] font-['Inter']">
                    {ticket.vehicle?.color || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Violation Details */}
            <div className="bg-[#F8F9FA] rounded-xl p-5 border border-[#E9ECF2]">
              <h3 className="text-sm font-['Oswald'] font-medium text-[#16233F] flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-[#F0B429]" />
                Violation Details
              </h3>
              <div className="space-y-3">
                {ticket.violations && ticket.violations.length > 0 ? (
                  ticket.violations.map((v, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center border-b border-[#E9ECF2] pb-2 last:border-0 last:pb-0"
                    >
                      <div className="flex-1">
                        <p className="text-[#1F2937] font-['Inter']">
                          {getViolationName(v)}
                        </p>
                        {v.violation_type?.description && (
                          <p className="text-xs text-[#64748B] font-['Inter']">
                            {v.violation_type.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-[#C8202F] font-['Inter'] font-semibold">
                          ₱{getFineAmount(v).toLocaleString()}
                        </p>
                        {v.demerit_points > 0 && (
                          <p className="text-xs text-[#64748B] font-['Inter']">
                            {v.demerit_points} pts
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[#64748B] font-['Inter'] text-center py-2">
                    No violations listed
                  </p>
                )}

                {/* ✅ FIXED: Total Fine - Now correctly calculated */}
                <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-[#16233F]">
                  <span className="font-['Oswald'] font-semibold text-[#16233F] text-base">
                    Total Fine
                  </span>
                  <span className="text-2xl font-bold text-[#C8202F]">
                    ₱{totalFine.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Location & Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#F8F9FA] rounded-xl p-5 border border-[#E9ECF2]">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#F0B429] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-[#64748B] font-['Inter'] font-medium">
                    Location
                  </p>
                  <p className="text-sm text-[#1F2937] font-['Inter']">
                    {ticket.location || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-[#F0B429] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-[#64748B] font-['Inter'] font-medium">
                    Date & Time
                  </p>
                  <p className="text-sm text-[#1F2937] font-['Inter']">
                    {ticket.violation_datetime
                      ? new Date(ticket.violation_datetime).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Enforcer Information */}
            <div className="bg-[#F8F9FA] rounded-xl p-5 border border-[#E9ECF2]">
              <h3 className="text-sm font-['Oswald'] font-medium text-[#16233F] flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-[#F0B429]" />
                Issued By
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-[#64748B] font-['Inter']">
                    Enforcer
                  </p>
                  <p className="text-[#1F2937] font-['Inter'] font-medium">
                    {ticket.enforcer?.firstname || ""}{" "}
                    {ticket.enforcer?.lastname || ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] font-['Inter']">Email</p>
                  <p className="text-[#1F2937] font-['Inter']">
                    {ticket.enforcer?.email || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-4 border-t border-[#E9ECF2]">
              <p className="text-xs text-[#94A3B8] font-['Inter']">
                This is an official traffic violation ticket issued by TEMU El
                Salvador City
              </p>
              <div className="flex items-center justify-center gap-4 mt-2">
                <div className="flex items-center gap-1 text-xs text-[#94A3B8] font-['Inter']">
                  <Building className="w-3 h-3" />
                  El Salvador City
                </div>
                <div className="flex items-center gap-1 text-xs text-[#94A3B8] font-['Inter']">
                  <Phone className="w-3 h-3" />
                  (088) 123-4567
                </div>
                <div className="flex items-center gap-1 text-xs text-[#94A3B8] font-['Inter']">
                  <Mail className="w-3 h-3" />
                  temu@elsalvador.gov.ph
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-[#94A3B8] font-['Inter']">
            &copy; {new Date().getFullYear()} TEMU - Traffic Enforcement and
            Management Unit
          </p>
          <p className="text-xs text-[#94A3B8] font-['Inter']">
            El Salvador City, Philippines
          </p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PublicTicket;
