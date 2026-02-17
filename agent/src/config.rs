use clap::Parser;

#[derive(Parser, Debug, Clone)]
#[command(name = "nanonet-agent")]
#[command(about = "NanoNet monitoring agent", long_about = None)]
pub struct Config {
    #[arg(long)]
    pub backend_url: String,

    #[arg(long)]
    pub service_id: String,

    #[arg(long)]
    pub agent_token: String,

    #[arg(long, default_value = "10")]
    pub poll_interval_sec: u64,
}
