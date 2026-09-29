import React, { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";
import { getTicketStatistics, getTickets } from "../services/api";
import {
  Ticket,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  TrendingUp,
  DollarSign,
  RefreshCw,
  Users,
  Car,
  Calendar,
  PhilippinePeso,
} from "lucide-react";
import { Button } from "../components/ui/button";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const Dashboard = () => {
  const [stats, setStats] = useState({
    total_tickets: 0,
    paid_tickets: 0,
    issued_tickets: 0,
    contested_tickets: 0,
    dismissed_tickets: 0,
    total_fines: 0,
    collected_fines: 0,
    collection_rate: 0,
  });
  const [recentTickets, setRecentTickets] = useState([]);
  const [ticketsByMonth, setTicketsByMonth] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('📊 Dashboard mounted, fetching data...');
    fetchData();
  }, []);

  const fetchData = async () => {
    console.log('🔄 Fetching dashboard data...');
    setLoading(true);
    setError(null);
    try {
      // ✅ Get statistics - properly handle the response
      console.log('📡 Calling getTicketStatistics()...');
      const statsRes = await getTicketStatistics();
      console.log('📊 Statistics response:', statsRes);
      
      // ✅ Check if we have valid data
      if (statsRes && statsRes.data) {
        const data = statsRes.data;
        console.log('📈 Statistics data:', data);
        
        // ✅ Set stats with proper values
        setStats({
          total_tickets: data.total_tickets || 0,
          paid_tickets: data.paid_tickets || 0,
          issued_tickets: data.issued_tickets || 0,
          contested_tickets: data.contested_tickets || 0,
          dismissed_tickets: data.dismissed_tickets || 0,
          total_fines: data.total_fines || 0,
          collected_fines: data.collected_fines || 0,
          collection_rate: data.collection_rate || 0,
        });
        
        // ✅ Set monthly data
        const monthlyData = data.tickets_by_month || [];
        console.log('📊 Monthly data:', monthlyData);
        setTicketsByMonth(monthlyData);
      } else {
        console.warn('⚠️ No data in statistics response');
      }

      // ✅ Get recent tickets
      console.log('📡 Fetching recent tickets...');
      const ticketsRes = await getTickets(1, 5);
      console.log('📊 Recent tickets response:', ticketsRes);
      
      let recentTicketsData = [];
      if (ticketsRes?.data?.data) {
        recentTicketsData = ticketsRes.data.data;
      } else if (ticketsRes?.data) {
        recentTicketsData = ticketsRes.data;
      }
      console.log('📋 Recent tickets count:', recentTicketsData.length);
      setRecentTickets(Array.isArray(recentTicketsData) ? recentTicketsData.slice(0, 5) : []);

    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      setError(
        "Failed to load dashboard data. Please make sure the API is running.",
      );
    } finally {
      setLoading(false);
      console.log('✅ Dashboard loading complete');
    }
  };

  // Helper to get total fine from ticket
  const getTotalFine = (ticket) => {
    if (!ticket) return 0;
    
    if (ticket.violations && Array.isArray(ticket.violations) && ticket.violations.length > 0) {
      return ticket.violations.reduce((sum, v) => {
        const fine = parseFloat(v?.fine_amount) || 0;
        return sum + fine;
      }, 0);
    }
    if (ticket.total_fine) {
      return parseFloat(ticket.total_fine) || 0;
    }
    return 0;
  };

  // Status pie chart data
  const pieData = [
    { name: "Paid", value: stats.paid_tickets, color: "#1E8449" },
    { name: "Issued", value: stats.issued_tickets, color: "#F0B429" },
    { name: "Contested", value: stats.contested_tickets, color: "#C2541F" },
    { name: "Dismissed", value: stats.dismissed_tickets, color: "#C8202F" },
  ].filter((item) => item.value > 0);

  const statCards = [
    {
      title: "Total Tickets",
      value: stats.total_tickets,
      icon: Ticket,
      color: "bg-[#16233F]",
      bgLight: "bg-[#E9ECF2]",
      textColor: "text-[#16233F]",
    },
    {
      title: "Paid Tickets",
      value: stats.paid_tickets,
      icon: CheckCircle,
      color: "bg-[#1E8449]",
      bgLight: "bg-[#E5F2EA]",
      textColor: "text-[#1E8449]",
    },
    {
      title: "Issued/Pending",
      value: stats.issued_tickets,
      icon: Clock,
      color: "bg-[#F0B429]",
      bgLight: "bg-[#FBF1DC]",
      textColor: "text-[#92600A]",
    },
    {
      title: "Contested",
      value: stats.contested_tickets,
      icon: AlertTriangle,
      color: "bg-[#C2541F]",
      bgLight: "bg-[#FBEAE2]",
      textColor: "text-[#C2541F]",
    },
    {
      title: "Dismissed",
      value: stats.dismissed_tickets,
      icon: XCircle,
      color: "bg-[#C8202F]",
      bgLight: "bg-[#FBE7E9]",
      textColor: "text-[#C8202F]",
    },
    {
      title: "Collection Rate",
      value: `${stats.collection_rate}%`,
      icon: TrendingUp,
      color: "bg-[#3B5170]",
      bgLight: "bg-[#EEF1F5]",
      textColor: "text-[#3B5170]",
    },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case "paid":
        return "bg-[#E5F2EA] text-[#1E8449]";
      case "issued":
        return "bg-[#FBF1DC] text-[#92600A]";
      case "contested":
        return "bg-[#FBEAE2] text-[#C2541F]";
      case "dismissed":
        return "bg-[#FBE7E9] text-[#C8202F]";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="w-4 h-4 text-[#1E8449]" />;
      case "issued":
        return <Clock className="w-4 h-4 text-[#92600A]" />;
      case "contested":
        return <AlertTriangle className="w-4 h-4 text-[#C2541F]" />;
      case "dismissed":
        return <XCircle className="w-4 h-4 text-[#C8202F]" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#16233F] mb-4"></div>
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="text-[#C8202F] mb-4 text-lg">⚠️ {error}</div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-['Oswald'] font-semibold text-[#16233F]">Dashboard</h1>
          <p className="text-[#64748B] font-['Inter'] mt-1">
            Welcome back! Here's what's happening with your traffic enforcement
            today.
          </p>
        </div>
        <Button
          onClick={fetchData}
          variant="outline"
          size="sm"
          className="border-[#1E8449]/30 text-[#1E8449] hover:bg-[#E5F2EA] hover:text-[#1E8449]"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${stat.bgLight}`}>
                    <stat.icon className={`w-5 h-5 ${stat.textColor}`} />
                  </div>
                  <span className="text-2xl font-bold text-gray-800">
                    {stat.value}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{stat.title}</p>
              </div>
              <div className={`h-1 w-full ${stat.color}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Tickets Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-['Oswald'] font-medium text-[#1F2937] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#16233F]" />
              Monthly Ticket Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!ticketsByMonth || ticketsByMonth.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={ticketsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="tickets"
                    stroke="#16233F"
                    strokeWidth={2}
                    name="Tickets Issued"
                    dot={{ fill: "#16233F", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-['Oswald'] font-medium text-[#1F2937] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#3B5170]" />
              Ticket Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary and Recent Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-['Oswald'] font-medium text-[#1F2937] flex items-center gap-2">
              <PhilippinePeso className="w-5 h-5 text-[#1E8449]" />
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Collection Rate</span>
                  <span className="font-semibold text-[#3B5170]">
                    {stats.collection_rate}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[#3B5170] rounded-full h-2 transition-all duration-500"
                    style={{
                      width: `${Math.min(stats.collection_rate, 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="text-center p-4 bg-[#E5F2EA] rounded-xl">
                  <PhilippinePeso className="w-6 h-6 text-[#1E8449] mx-auto mb-2" />
                  <p className="text-2xl font-bold text-[#1E8449]">
                    ₱{stats.collected_fines?.toLocaleString() || 0}
                  </p>
                  <p className="text-xs text-gray-500">Collected Fines</p>
                </div>
                <div className="text-center p-4 bg-[#FBF1DC] rounded-xl">
                  <Clock className="w-6 h-6 text-[#92600A] mx-auto mb-2" />
                  <p className="text-2xl font-bold text-[#92600A]">
                    ₱{((stats.total_fines || 0) - (stats.collected_fines || 0)).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Pending Collection</p>
                </div>
              </div>

              <div className="border-t pt-4 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Fines Issued</span>
                  <span className="text-xl font-bold text-gray-800">
                    ₱{stats.total_fines?.toLocaleString() || 0}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Tickets */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg font-['Oswald'] font-medium text-[#1F2937] flex items-center gap-2">
                <Ticket className="w-5 h-5 text-[#16233F]" />
                Recent Tickets
              </CardTitle>
              <span className="text-xs text-gray-400">Last 5 tickets</span>
            </div>
          </CardHeader>
          <CardContent>
            {!recentTickets || recentTickets.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No tickets found
              </div>
            ) : (
              <div className="space-y-3">
                {recentTickets.map((ticket) => {
                  const totalFine = getTotalFine(ticket);
                  return (
                    <div
                      key={ticket.ticket_id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-semibold text-gray-800">
                            {ticket.ticket_number}
                          </span>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(ticket.status)}
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(ticket.status)}`}
                            >
                              {ticket.status?.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">
                          {ticket.violator?.firstname} {ticket.violator?.lastname}
                        </p>
                        <div className="flex items-center gap-4 mt-1">
                          <p className="text-xs text-gray-400">
                            <Car className="w-3 h-3 inline mr-1" />
                            {ticket.vehicle?.platenumber}
                          </p>
                          <p className="text-xs text-gray-400">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {ticket.violation_datetime ? new Date(ticket.violation_datetime).toLocaleDateString() : 'N/A'}
                          </p>
                          <p className="text-xs font-semibold text-[#C8202F]">
                            ₱{totalFine.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#E9ECF2] rounded-lg">
              <Users className="w-5 h-5 text-[#16233F]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">
                {stats.total_tickets}
              </p>
              <p className="text-xs text-gray-500">Total Violations</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#E5F2EA] rounded-lg">
              <CheckCircle className="w-5 h-5 text-[#1E8449]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">
                {stats.paid_tickets}
              </p>
              <p className="text-xs text-gray-500">Resolved Cases</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FBF1DC] rounded-lg">
              <Clock className="w-5 h-5 text-[#92600A]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">
                {stats.issued_tickets}
              </p>
              <p className="text-xs text-gray-500">Active Cases</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#EEF1F5] rounded-lg">
              <TrendingUp className="w-5 h-5 text-[#3B5170]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">
                {stats.collection_rate}%
              </p>
              <p className="text-xs text-gray-500">Efficiency Rate</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;