<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    use HasFactory;

    protected $primaryKey = 'setting_id';
    
    protected $fillable = [
        'setting_key', 'setting_value', 'setting_type', 'description', 'group_name'
    ];

    // Helper method to get setting value
    public static function get($key, $default = null)
    {
        $setting = self::where('setting_key', $key)->first();
        if (!$setting) {
            return $default;
        }

        switch ($setting->setting_type) {
            case 'boolean':
                return filter_var($setting->setting_value, FILTER_VALIDATE_BOOLEAN);
            case 'number':
                return is_numeric($setting->setting_value) ? (float) $setting->setting_value : $default;
            case 'json':
                return json_decode($setting->setting_value, true);
            default:
                return $setting->setting_value;
        }
    }
}